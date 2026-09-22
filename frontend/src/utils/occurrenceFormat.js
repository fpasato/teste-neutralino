export const STATUS_LABELS = {
  active: "Ativo",
  in_progress: "Em andamento",
  finished: "Finalizado",
  cancelled: "Cancelado",
  unresolved: "Não resolvido",
};

export const ROLE_LABELS = {
  attendant: "Atendente",
  supervisor: "Supervisor",
  admin: "Administrador",
};

/** ID curto da ocorrência — usado na lista, no header e no nome do CSV. */
export function shortId(id) {
  return id ? `#${String(id).slice(0, 8)}` : "-";
}

export function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value) {
  if (!value) return "-";
  // birth_date vem como "YYYY-MM-DD": evita o deslocamento de fuso.
  const [y, m, d] = String(value).split("T")[0].split("-");
  return d && m && y ? `${d}/${m}/${y}` : "-";
}

/** Duração legível entre dois instantes (ex.: "1h 12min"). */
export function diffToHuman(start, end) {
  if (!start || !end) return "-";
  const ms = new Date(end) - new Date(start);
  if (ms < 0) return "-";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}