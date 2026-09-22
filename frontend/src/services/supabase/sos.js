import { supabase } from "./client";
import { applyDateRangeFilter } from "../../utils/dateRangeFilters";
import { logAuditContext, logEvent } from "./audit";

const SOS_SELECT = `
  id,
  status,
  created_at,
  closed_at,
  attendant_id,
  dispatched_at,
  dispatch_eta,
  latitude,
  longitude,
  city,
  uf,
  ibge_code,
  profiles (
    name,
    phone
  ),
  attendants (
    name
  ),
  locations (
    id,
    latitude,
    longitude,
    accuracy,
    created_at
  )
`;

/**
 * Garante que o atendente logado esta ativo antes de permitir qualquer alteracao.
 * A garantia de verdade fica na RLS (attendants.active = true nas policies de UPDATE/INSERT),
 * isso aqui e so pra dar feedback imediato no client, sem esperar o round-trip do banco.
 */
async function ensureActiveAttendant() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Sessão inválida. Faça login novamente.");
  }

  const { data: attendant, error: attendantError } = await supabase
    .from("attendants")
    .select("active")
    .eq("id", user.id)
    .single();

  if (attendantError || !attendant) {
    throw new Error("Atendente não encontrado.");
  }

  if (!attendant.active) {
    throw new Error("Sua conta está desativada. Contate um administrador.");
  }

  return user;
}

/**
 * Registra o evento de negócio "SOS criado". Diferente das outras funções
 * de evento aqui, essa precisa ser chamada explicitamente pelo código que
 * cria o SOS (app do usuário), já que esse INSERT não passa por este arquivo.
 * Chame logo após o INSERT em "sos" ser bem-sucedido, passando o id retornado.
 */
export async function logSosCreated(sosId) {
  await logEvent({
    tableName: "sos",
    recordId: sosId,
    eventType: "SOS_CREATED",
    description: "Novo SOS criado pelo usuário",
    origin: "mobile",
  });
}

export async function getSosById(id) {
  const { data, error } = await supabase
    .from("sos")
    .select(SOS_SELECT)
    .eq("id", id)
    .order("created_at", { foreignTable: "locations", ascending: true })
    .single();
 
  if (error) throw error;
  return data;
}
 

export async function attendSos(sosId, attendantId) {
  await ensureActiveAttendant();

  const { data, error } = await supabase
    .from("sos")
    .update({ status: "in_progress", attendant_id: attendantId })
    .eq("id", sosId)
    .is("attendant_id", null)
    .select();

  if (error) throw error;

  if (!data || data.length === 0) {
    throw new Error("Esse SOS já foi atendido por outro atendente.");
  }

  await logAuditContext({
    tableName: "sos",
    recordId: sosId,
    description: "SOS aceito por atendente",
    origin: "web",
  });

  await logEvent({
    tableName: "sos",
    recordId: sosId,
    eventType: "SOS_ACCEPTED",
    description: "SOS aceito por atendente",
    origin: "web",
  });

  return data[0];
}

export async function getAllSos({
  status,
  startDate,
  endDate,
  attendantId,
  ibgeCode,
  ibgeCodes,
  sortBy = "recent",
} = {}) {
  let query = supabase.from("sos").select(SOS_SELECT);

  if (sortBy === "oldest") {
    query = query.order("created_at", { ascending: true });
  } else if (sortBy === "longest_wait") {
    query = query.order("created_at", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  query = query.order("created_at", {
    foreignTable: "locations",
    ascending: true,
  });

  if (Array.isArray(status) && status.length > 0) {
    query = query.in("status", status);
  } else if (status && typeof status === "string") {
    query = query.eq("status", status);
  }

  query = applyDateRangeFilter(query, startDate, endDate);

  if (attendantId) {
    query = query.eq("attendant_id", attendantId);
  }

  if (Array.isArray(ibgeCodes) && ibgeCodes.length > 0) {
    query = query.in("ibge_code", ibgeCodes);
  } else if (ibgeCode) {
    query = query.eq("ibge_code", ibgeCode);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function finishSos(sosId) {
  await ensureActiveAttendant();

  const { data, error } = await supabase
    .from("sos")
    .update({
      status: "finished",
      closed_at: new Date().toISOString(),
    })
    .eq("id", sosId)
    .select()
    .single();

  if (error) throw error;

  await logAuditContext({
    tableName: "sos",
    recordId: sosId,
    description: "Ocorrência finalizada",
    origin: "web",
  });

  await logEvent({
    tableName: "sos",
    recordId: sosId,
    eventType: "SOS_FINISHED",
    description: "Ocorrência finalizada",
    origin: "web",
  });

  return data;
}

// chegada aleatório entre DISPATCH_MIN_MS e DISPATCH_MAX_MS.
// O scheduler central (dispatchScheduler.js) é quem realmente agenda
// a finalização automática — aqui só persistimos o estado no banco.
const DISPATCH_MIN_MS = 2 * 60 * 1000; // 2 minutos
const DISPATCH_MAX_MS = 30 * 60 * 1000; // 30 minutos

export async function dispatchSos(sosId) {
  await ensureActiveAttendant();

  const delay =
    DISPATCH_MIN_MS + Math.random() * (DISPATCH_MAX_MS - DISPATCH_MIN_MS);

  const dispatchedAt = new Date();
  const dispatchEta = new Date(dispatchedAt.getTime() + delay);

  const { data, error } = await supabase
    .from("sos")
    .update({
      dispatched_at: dispatchedAt.toISOString(),
      dispatch_eta: dispatchEta.toISOString(),
    })
    .eq("id", sosId)
    .is("dispatched_at", null) // evita redespachar se já foi despachado
    .select()
    .single();

  if (error) throw error;

  if (!data) {
    throw new Error("Esse SOS já teve uma viatura despachada.");
  }

  await logAuditContext({
    tableName: "sos",
    recordId: sosId,
    description: "Viatura despachada",
    origin: "web",
  });

  await logEvent({
    tableName: "sos",
    recordId: sosId,
    eventType: "SOS_DISPATCHED",
    description: "Viatura despachada",
    origin: "web",
    metadata: { dispatch_eta: dispatchEta.toISOString() },
  });

  return data;
}

/*
 * Lista atendentes ativos para o seletor do modal de atribuicao.
 * Independente do SOS_SELECT porque a tela de atribuir precisa de id/role,
 * que nao fazem parte do relacionamento aninhado em "sos".
 */

export async function getAssignableAttendants({ ibgeCode } = {}) {
  let query = supabase
    .from("attendants")
    .select("id, name, role, ibge_code, active")
    .eq("active", true)
    .order("name", { ascending: true });

  if (ibgeCode) {
    query = query.eq("ibge_code", ibgeCode);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

/**
 * Atribui (ou reatribui) uma ocorrencia a um atendente especifico.
 * Diferente de attendSos(): essa funcao NAO checa .is("attendant_id", null)
 * porque e usada por admin/supervisor para reatribuir livremente, inclusive
 * ocorrencias ja atribuidas a outro atendente.
 * Ao atribuir um atendente (attendantId != null), o status tambem muda para
 * "in_progress" - mesmo comportamento de attendSos(), so que sem a checagem
 * de concorrencia (.is("attendant_id", null)), pois admin/supervisor podem
 * reatribuir uma ocorrencia ja em andamento.
 * Ao desatribuir (attendantId == null), o status NAO e alterado automaticamente
 * (fica a criterio de quem chama decidir se volta pra "active" ou nao).
 * Passa pela policy "sos_update_admin" (admin) ou "sos_reassign_supervisor"
 * (supervisor) - ver migration 2026_supervisor_reassign_sos.sql.
 * Atendente comum tentando atribuir a outro colega e bloqueado pelo RLS.
 */
export async function assignSos(sosId, attendantId) {
  await ensureActiveAttendant();

  const payload = { attendant_id: attendantId };
  if (attendantId) {
    payload.status = "in_progress";
  }

  const { data, error } = await supabase
    .from("sos")
    .update(payload)
    .eq("id", sosId)
    .select(SOS_SELECT)
    .single();

  if (error) throw error;

  await logAuditContext({
    tableName: "sos",
    recordId: sosId,
    description: attendantId ? "Ocorrência atribuída a atendente" : "Atendente removido da ocorrência",
    origin: "web",
  });

  await logEvent({
    tableName: "sos",
    recordId: sosId,
    eventType: attendantId ? "SOS_ASSIGNED" : "SOS_UNASSIGNED",
    description: attendantId ? "Ocorrência atribuída a atendente" : "Atendente removido da ocorrência",
    origin: "web",
  });

  return data;
}

/**
 * Reatribui um SOS para outro atendente. Só admin (via RLS "sos_update_admin"),
 * e só para SOS com status active ou in_progress (mesma restricao aplicada na RLS).
 */
export async function reassignSos(sosId, newAttendantId) {
  const { data, error } = await supabase
    .from("sos")
    .update({ attendant_id: newAttendantId, status: "in_progress" })
    .eq("id", sosId)
    .select()
    .single();

  if (error) throw error;

  await logAuditContext({
    tableName: "sos",
    recordId: sosId,
    description: "Ocorrência reatribuída a outro atendente",
    origin: "web",
  });

  await logEvent({
    tableName: "sos",
    recordId: sosId,
    eventType: "SOS_REASSIGNED",
    description: "Ocorrência reatribuída a outro atendente",
    origin: "web",
  });

  return data;
}

/**
 * Remove o atendente atribuido a um SOS, deixando disponivel para qualquer atendente pegar.
 * Nao mexemos no status aqui - o trigger check_sos_status_transition nao permite
 * in_progress -> active diretamente. O SOS fica com attendant_id = null no status atual.
 */
export async function unassignSos(sosId) {
  const { data, error } = await supabase
    .from("sos")
    .update({ attendant_id: null })
    .eq("id", sosId)
    .select()
    .single();

  if (error) throw error;

  await logAuditContext({
    tableName: "sos",
    recordId: sosId,
    description: "Atendente desatribuído da ocorrência",
    origin: "web",
  });

  return data;
}

/**
 * Assina mudancas em tempo real na tabela sos (Supabase Realtime) para
 * atualizar a listagem sem precisar dar refresh manual.
 * Quem chamar deve dar supabase.removeChannel(channel) no cleanup do useEffect.
 */
export function subscribeToSos(onChange) {
  const channel = supabase
    .channel("sos-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "sos" },
      (payload) => onChange(payload),
    )
    .subscribe();

  return channel;
}

/**
 * Remove o atendente atribuído a uma ocorrência (volta pra "Nao atribuido").
 */
export async function removeAttendantFromSos(sosId) {
  const { data, error } = await supabase
    .from("sos")
    .update({ attendant_id: null })
    .eq("id", sosId)
    .select()
    .single();

  if (error) throw error;

  await logAuditContext({
    tableName: "sos",
    recordId: sosId,
    description: "Removeu atendente da ocorrência",
    origin: "web",
  });

  return data;
}

/**
 * Busca uma ocorrência com todos os dados relacionados pra exportação:
 * solicitante completo, atendente, município/região, e histórico de
 * TODAS as localizações reportadas durante o SOS (tabela locations).
 */
export async function getSosFullDetails(sosId) {
  const { data: occurrence, error: occError } = await supabase
    .from("sos")
    .select(
      `
      id,
      status,
      created_at,
      closed_at,
      dispatched_at,
      dispatch_eta,
      city,
      uf,
      ibge_code,
      latitude,
      longitude,
      attendant_id,
      user_id,
      profiles:user_id ( name, cpf, phone, birth_date ),
      attendants:attendant_id ( name, email ),
      municipalities:ibge_code ( city, uf, region_id, regions:region_id ( name ) )
    `
    )
    .eq("id", sosId)
    .single();

  if (occError) throw occError;

  const { data: locations, error: locError } = await supabase
    .from("locations")
    .select("id, latitude, longitude, accuracy, created_at")
    .eq("sos_id", sosId)
    .order("created_at", { ascending: true });

  if (locError) throw locError;

  return { ...occurrence, locations: locations || [] };
}