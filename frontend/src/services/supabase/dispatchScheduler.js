import { supabase } from "./client";
import { finishSos } from "./sos";

// Guarda os timeouts ativos por sos.id, pra não duplicar agendamento
// se o scheduler for iniciado mais de uma vez (ex: hot reload em dev).
const activeTimeouts = new Map();

function scheduleFinish(sosId, etaISOString) {
  if (activeTimeouts.has(sosId)) {
    clearTimeout(activeTimeouts.get(sosId));
  }

  const delay = new Date(etaISOString).getTime() - Date.now();

  const run = async () => {
    try {
      await finishSos(sosId);
    } catch (err) {
      console.error(`Erro ao finalizar SOS ${sosId} automaticamente:`, err);
    } finally {
      activeTimeouts.delete(sosId);
    }
  };

  if (delay <= 0) {
    run();
    return;
  }

  const timeoutId = setTimeout(run, delay);
  activeTimeouts.set(sosId, timeoutId);
}

async function loadPendingDispatches() {
  const { data, error } = await supabase
    .from("sos")
    .select("id, dispatch_eta")
    .not("dispatched_at", "is", null)
    .not("dispatch_eta", "is", null)
    .in("status", ["active", "in_progress"]);

  if (error) {
    console.error("Erro ao carregar despachos pendentes:", error);
    return;
  }

  data.forEach((sos) => scheduleFinish(sos.id, sos.dispatch_eta));
}

let started = false;

export function startDispatchScheduler() {
  if (started) return; 
  started = true;

  loadPendingDispatches();

  supabase
    .channel("dispatch-scheduler")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "sos" },
      (payload) => {
        const sos = payload.new;
        if (sos.dispatched_at && sos.dispatch_eta && sos.status !== "finished" && sos.status !== "cancelled") {
          scheduleFinish(sos.id, sos.dispatch_eta);
        } else if (activeTimeouts.has(sos.id)) {
          clearTimeout(activeTimeouts.get(sos.id));
          activeTimeouts.delete(sos.id);
        }
      },
    )
    .subscribe();
}