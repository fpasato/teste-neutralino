import { supabase } from "./client";
import { getMunicipalitiesByRegion } from "./municipalities";

const PAGE_SIZE = 20;

/**
 * Complementa a linha de audit_log que o trigger do banco (fn_audit_log)
 * já inseriu automaticamente, com contexto que só a aplicação sabe
 * (descrição amigável e origem da chamada).
 *
 * Não criamos a linha aqui — o trigger já fez isso com old_data/new_data
 * corretos dentro da mesma transação. Aqui só damos PATCH na mais recente
 * linha daquele record_id (chamar isso logo após a operação de escrita,
 * sem await de outras coisas no meio, minimiza risco de pegar a linha errada
 * em caso de duas edições concorrentes no mesmo registro).
 */
export async function logAuditContext({ tableName, recordId, description, origin = "web" }) {
  const { data: recent, error: findError } = await supabase
    .from("audit_log")
    .select("id")
    .eq("table_name", tableName)
    .eq("record_id", recordId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (findError || !recent) {
    console.error("Não foi possível localizar o log de auditoria para complementar:", findError);
    return;
  }

  const { data: updated, error: updateError } = await supabase
    .from("audit_log")
    .update({ description, origin })
    .eq("id", recent.id)
    .select("id");

  if (updateError) {
    console.error("Erro ao complementar audit_log:", updateError);
    return;
  }

  if (!updated || updated.length === 0) {
    console.warn(
      "audit_log não foi atualizado — provável bloqueio de RLS (falta policy de UPDATE para este usuário)."
    );
  }
}

/**
 * Só resolve a parte assíncrona (buscar os códigos IBGE da região).
 * Não toca no query builder — evita o auto-unwrap de thenable.
 */
async function resolveLocationFilter(filters) {
  if (filters.ibgeCode && filters.ibgeCode !== "all") {
    return { type: "eq", value: filters.ibgeCode };
  }
  if (filters.regionId && filters.regionId !== "all") {
    const municipios = await getMunicipalitiesByRegion(filters.regionId);
    return { type: "in", value: municipios.map((m) => m.ibge_code) };
  }
  return null;
}

/**
 * Aplica o filtro já resolvido no query builder — sempre síncrono.
 */
function applyLocationFilter(query, locationFilter) {
  if (!locationFilter) return query;
  if (locationFilter.type === "eq") {
    return query.eq("ibge_code", locationFilter.value);
  }
  if (locationFilter.type === "in") {
    if (locationFilter.value.length === 0) return query.eq("ibge_code", -1);
    return query.in("ibge_code", locationFilter.value);
  }
  return query;
}

export async function getAuditLogs(filters = {}, page = 1) {
  let query = supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters.startDate) {
    query = query.gte("created_at", new Date(filters.startDate).toISOString());
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    if (filters.endDate.length <= 10) end.setHours(23, 59, 59, 999);
    query = query.lte("created_at", end.toISOString());
  }
  if (filters.tableName && filters.tableName !== "all") {
    query = query.eq("table_name", filters.tableName);
  }
  if (filters.action && filters.action !== "all") {
    query = query.eq("action", filters.action);
  }
  if (filters.userId && filters.userId !== "all") {
    query = query.eq("changed_by", filters.userId);
  }

  const locationFilter = await resolveLocationFilter(filters); // await isolado, antes do builder
  query = applyLocationFilter(query, locationFilter);           // chamada síncrona

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

/**
 * Registra um EVENTO (não é uma mudança de linha de CRUD, então não existe
 * trigger que capte isso sozinho). Usar para coisas como login/logout,
 * envio de notificação, SOS aceito/despachado como marco de negócio, etc.
 * Diferente de logAuditContext: aqui CRIAMOS a linha, não complementamos uma existente.
 */
export async function logEvent({ tableName, recordId, eventType, description, origin = "web", metadata = null, ibgeCode = null }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;

  const { error } = await supabase.from("audit_log").insert({
    table_name: tableName,
    record_id: recordId,
    action: "EVENT",
    changed_by: user?.id ?? null,
    changed_by_email: user?.email ?? null,
    event_type: eventType,
    description,
    origin,
    metadata,
    ibge_code: ibgeCode,
  });

  if (error) {
    console.error("Erro ao registrar evento em audit_log:", error);
  }
}

/**
 * Busca TODOS os registros que batem com o filtro (ignora paginação) para exportação.
 * Cuidado: sem limite de linhas — em volumes muito grandes (dezenas de milhares),
 * considerar exportar em background/Edge Function em vez de trazer tudo pro client.
 */
export async function getAuditLogsForExport(filters = {}) {
  let query = supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.startDate) {
    query = query.gte("created_at", new Date(filters.startDate).toISOString());
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    if (filters.endDate.length <= 10) end.setHours(23, 59, 59, 999);
    query = query.lte("created_at", end.toISOString());
  }
  if (filters.tableName && filters.tableName !== "all") {
    query = query.eq("table_name", filters.tableName);
  }
  if (filters.action && filters.action !== "all") {
    query = query.eq("action", filters.action);
  }
  if (filters.userId && filters.userId !== "all") {
    query = query.eq("changed_by", filters.userId);
  }

  const locationFilter = await resolveLocationFilter(filters);
  query = applyLocationFilter(query, locationFilter);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}


function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const EXPORT_COLUMNS = [
  { key: "created_at", label: "Data/Hora" },
  { key: "action", label: "Ação" },
  { key: "event_type", label: "Tipo de Evento" },
  { key: "table_name", label: "Tabela/Módulo" },
  { key: "description", label: "Descrição" },
  { key: "changed_by_email", label: "Usuário" },
  { key: "record_id", label: "Registro" },
  { key: "ibge_code", label: "Código IBGE" },
  { key: "origin", label: "Origem" },
  { key: "old_data", label: "Dados Anteriores" },
  { key: "new_data", label: "Novos Dados" },
];

/**
 * Gera o CSV em memória (string) a partir dos logs já buscados.
 */
export function buildAuditCsv(logs) {
  const header = EXPORT_COLUMNS.map((c) => csvEscape(c.label)).join(",");
  const rows = logs.map((log) =>
    EXPORT_COLUMNS.map((c) => csvEscape(log[c.key])).join(",")
  );
  return [header, ...rows].join("\n");
}

/**
 * Busca os logs do filtro atual, gera o CSV e dispara o download no navegador.
 */
export async function exportAuditLogsCsv(filters = {}) {
  const logs = await getAuditLogsForExport(filters);
  const csv = buildAuditCsv(logs);

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  link.href = url;
  link.download = `auditoria_${timestamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return logs.length;
}

export async function getAuditStats(filters = {}) {
  let query = supabase.from("audit_log").select("action, changed_by, created_at, ibge_code");

  if (filters.startDate) query = query.gte("created_at", new Date(filters.startDate).toISOString());
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    if (filters.endDate.length <= 10) end.setHours(23, 59, 59, 999);
    query = query.lte("created_at", end.toISOString());
  }

  const locationFilter = await resolveLocationFilter(filters);
  query = applyLocationFilter(query, locationFilter);

  const { data, error } = await query;
  if (error) throw error;

  const total = data.length;
  const crud = data.filter((l) => l.action !== "EVENT").length;
  const events = data.filter((l) => l.action === "EVENT").length;
  const activeUsers = new Set(data.map((l) => l.changed_by).filter(Boolean)).size;

  // ---- donut: ações por tipo ----
  const actionCounts = data.reduce((acc, l) => {
    acc[l.action] = (acc[l.action] || 0) + 1;
    return acc;
  }, {});

  const ACTION_COLORS = {
    INSERT: "#4ade80",
    UPDATE: "#60a5fa",
    DELETE: "#f87171",
    EVENT: "#fbbf24",
  };

  const byAction = Object.entries(actionCounts).map(([action, count]) => ({
    action,
    count,
    percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    color: ACTION_COLORS[action] || "#94a3b8",
  }));

  // ---- linha: atividade por dia (preenchendo dias sem registro com 0) ----
  const dayCounts = data.reduce((acc, l) => {
    const day = l.created_at.slice(0, 10);
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});

  let byDay = [];
  if (data.length > 0) {
    const allDates = data.map((l) => l.created_at.slice(0, 10)).sort();
    const start = filters.startDate ? filters.startDate.slice(0, 10) : allDates[0];
    const end = filters.endDate ? filters.endDate.slice(0, 10) : allDates[allDates.length - 1];

    const cursor = new Date(start + "T00:00:00");
    const endDateObj = new Date(end + "T00:00:00");

    while (cursor <= endDateObj) {
      const key = cursor.toISOString().slice(0, 10);
      byDay.push({ date: key, count: dayCounts[key] || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return { total, crud, events, activeUsers, byAction, byDay };
}




