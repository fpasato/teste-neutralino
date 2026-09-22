import { supabase } from "./client";

function toISODateOnly(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function pctChange(atual, anterior) {
  if (!anterior) return atual > 0 ? 100 : 0;
  return Number((((atual - anterior) / anterior) * 100).toFixed(1));
}

// Busca ocorrências brutas dentro de um intervalo de datas (inclusive)
async function fetchSosInRange(startDate, endDate, ibgeCode, ibgeCodes) {
  let query = supabase
    .from("sos")
    .select("id, status, created_at, closed_at, dispatched_at, attendant_id, uf")
    .gte("created_at", `${startDate}T00:00:00-03:00`)
    .lte("created_at", `${endDate}T23:59:59-03:00`)
    .order("created_at", { ascending: false });

  if (Array.isArray(ibgeCodes) && ibgeCodes.length > 0) {
    query = query.in("ibge_code", ibgeCodes);
  } else if (ibgeCode) {
    query = query.eq("ibge_code", ibgeCode);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// getSosStats: estatísticas filtráveis (status, período, atendente)
// ---------------------------------------------------------------------------
export async function getSosStats({
  status,
  startDate,
  endDate,
  attendantId,
  ibgeCode,
  ibgeCodes,
} = {}) {
  function applyFilters(query) {
    if (Array.isArray(status) && status.length > 0) {
      query = query.in("status", status);
    } else if (status && typeof status === "string") {
      query = query.eq("status", status);
    }
    if (startDate) query = query.gte("created_at", `${startDate}T00:00:00-03:00`);
    if (endDate) query = query.lte("created_at", `${endDate}T23:59:59-03:00`);
    if (attendantId) query = query.eq("attendant_id", attendantId);
    
    if (Array.isArray(ibgeCodes) && ibgeCodes.length > 0) {
      query = query.in("ibge_code", ibgeCodes);
    } else if (ibgeCode) {
      query = query.eq("ibge_code", ibgeCode);
    }
    
    return query;
  }

  const { count: total, error: totalError } = await applyFilters(
    supabase.from("sos").select("*", { count: "exact", head: true })
  );
  if (totalError) throw totalError;

  const { count: inProgress, error: progressError } = await applyFilters(
    supabase.from("sos").select("*", { count: "exact", head: true })
  ).eq("status", "in_progress");
  if (progressError) throw progressError;

  const { count: active, error: activeError } = await applyFilters(
    supabase.from("sos").select("*", { count: "exact", head: true })
  ).eq("status", "active");
  if (activeError) throw activeError;

  const { count: cancelled, error: cancelledError } = await applyFilters(
    supabase.from("sos").select("*", { count: "exact", head: true })
  ).eq("status", "cancelled");
  if (cancelledError) throw cancelledError;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: finishedToday, error: finishedError } = await applyFilters(
    supabase.from("sos").select("*", { count: "exact", head: true })
  )
    .eq("status", "finished")
    .gte("closed_at", todayStart.toISOString());
  if (finishedError) throw finishedError;

  const { data: dispatchedSos, error: avgError } = await applyFilters(
    supabase.from("sos").select("created_at, dispatched_at")
  ).not("dispatched_at", "is", null);
  if (avgError) throw avgError;

  let avgResponseMinutes = null;
  if (dispatchedSos.length > 0) {
    const totalMs = dispatchedSos.reduce((sum, sos) => {
      return sum + (new Date(sos.dispatched_at) - new Date(sos.created_at));
    }, 0);
    avgResponseMinutes = Math.round(totalMs / dispatchedSos.length / 60000);
  }

  return {
    total: total ?? 0,
    active: active ?? 0,
    inProgress: inProgress ?? 0,
    cancelled: cancelled ?? 0,
    finishedToday: finishedToday ?? 0,
    avgResponseMinutes,
  };
}

// ---------------------------------------------------------------------------
// getDashboardStats: monta cards + gráficos para um período escolhido no
// calendário (mínimo 7 dias). Compara com o período anterior de mesma duração.
// ---------------------------------------------------------------------------
export async function getDashboardStats({ startDate, endDate, ibgeCode, ibgeCodes }) {
  const start = new Date(`${startDate}T00:00:00-03:00`);
  const end = new Date(`${endDate}T23:59:59-03:00`);
  const durationMs = end - start;

  const prevEnd = new Date(start);
  prevEnd.setSeconds(prevEnd.getSeconds() - 1); // 1s antes do início do período atual
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  const prevStartDate = toISODateOnly(prevStart);
  const prevEndDate = toISODateOnly(prevEnd);

  // hoje / ontem, sempre relativos à data real (não ao filtro), pro card "finalizadas hoje"
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const [atual, anterior, hoje, ontem, sosBruto] = await Promise.all([
    getSosStats({ startDate, endDate, ibgeCode, ibgeCodes }),
    getSosStats({ startDate: prevStartDate, endDate: prevEndDate, ibgeCode, ibgeCodes }),
    getSosStats({ startDate: toISODateOnly(todayStart), endDate: toISODateOnly(todayStart), ibgeCode, ibgeCodes }),
    getSosStats({ startDate: toISODateOnly(yesterdayStart), endDate: toISODateOnly(yesterdayStart), ibgeCode, ibgeCodes }),
    fetchSosInRange(startDate, endDate, ibgeCode, ibgeCodes),
  ]);

  const lineData = buildLineData(sosBruto, startDate, endDate);
  const heatmapMatrix = buildHeatmapMatrix(sosBruto);
  const statusCounts = buildStatusCounts(sosBruto);
  const recentes = [...sosBruto]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return {
    cards: {
      totalGeral: atual.total,
      pctTotalSemana: pctChange(atual.total, anterior.total),
      emAndamento: atual.active + atual.inProgress,
      pctEmAndamento: atual.total
        ? Number((((atual.active + atual.inProgress) / atual.total) * 100).toFixed(1))
        : 0,
      finalizadasHoje: hoje.finishedToday,
      pctFinalizadasHoje: pctChange(hoje.finishedToday, ontem.finishedToday),
      tempoMedioAtual: atual.avgResponseMinutes ?? 0,
      pctTempoMedio: pctChange(atual.avgResponseMinutes ?? 0, anterior.avgResponseMinutes ?? 0),
      canceladas: atual.cancelled,
      pctCanceladas: pctChange(atual.cancelled, anterior.cancelled),
    },
    lineData,
    heatmapMatrix,
    statusCounts,
    recentes,
  };
}

function buildLineData(sos, startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00-03:00`);
  const end = new Date(`${endDate}T00:00:00-03:00`);
  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((end - start) / dayMs) + 1;

  const linePorDia = {};
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start.getTime() + i * dayMs);
    const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    linePorDia[key] = 0;
  }
  sos.forEach((o) => {
    const key = new Date(o.created_at).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
    if (key in linePorDia) linePorDia[key] += 1;
  });
  return Object.entries(linePorDia).map(([data, total]) => ({ data, total }));
}

// Matriz 7 (dias da semana, 0=domingo) x 24 (horas)
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function buildHeatmapMatrix(sos) {
  const matrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));

  sos.forEach((o) => {
    const d = new Date(o.created_at);
    matrix[d.getDay()][d.getHours()] += 1;
  });

  const max = Math.max(...matrix.flat(), 1);

  return {
    max,
    rows: DIAS_SEMANA.map((label, dayIndex) => ({
      label,
      cells: matrix[dayIndex].map((count, hour) => ({
        hour,
        count,
        intensity: count / max,
      })),
    })),
  };
}

function buildStatusCounts(sos) {
  const statusCounts = {
    active: 0,
    in_progress: 0,
    finished: 0,
    cancelled: 0,
    unresolved: 0,
  };
  sos.forEach((o) => {
    if (statusCounts[o.status] !== undefined) statusCounts[o.status] += 1;
  });
  return statusCounts;
}