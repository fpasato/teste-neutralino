// utils/sosDisplay.js

export function getElapsedTime(createdAt) {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}min`;
}

export function getVehicleStatus(sos) {
  if (!sos.dispatched_at) return "Não despachada";
  if (sos.status === "finished") return "Atendimento concluído";

  const eta = new Date(sos.dispatch_eta);
  const now = new Date();

  if (now >= eta) return "Chegando ao local";
  return "A caminho";
}

export function getLatestAccuracy(sos) {
  if (!sos || !sos.locations || sos.locations.length === 0) return null;
  const latest = sos.locations[sos.locations.length - 1];
  return latest.accuracy;
}