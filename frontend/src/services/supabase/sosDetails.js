import { supabase } from "./client";

/**
 * Busca TUDO que a tela de detalhes precisa de uma ocorrência:
 * solicitante completo, atendente (com cargo, município e região),
 * município/região do SOS e o histórico completo de localizações.
 *
 * Obs.: e-mail do solicitante não existe em public.profiles (fica em
 * auth.users, inacessível pelo client). O componente mostra "-" nesse caso.
 */
export async function getOccurrenceDetails(sosId) {
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
      profiles:user_id ( id, name, email, cpf, phone, birth_date, created_at ),
      attendants:attendant_id (
        id,
        name,
        email,
        role,
        ibge_code,
        municipalities:ibge_code ( city, uf, region_id, regions:region_id ( name ) )
      ),
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

/**
 * Trilha de auditoria da ocorrência (audit_log).
 * Traz tanto os EVENTs de negócio quanto os UPDATEs de linha, em ordem
 * cronológica. É a fonte do card "Histórico de status" e complementa a
 * linha do tempo.
 */
export async function getSosAuditTrail(sosId) {
  const { data, error } = await supabase
    .from("audit_log")
    .select(
      "id, action, event_type, description, changed_by, changed_by_email, old_data, new_data, origin, metadata, created_at"
    )
    .eq("table_name", "sos")
    .eq("record_id", sosId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

/** Só as entradas que representam mudança de status.
 * Restrito a action === "UPDATE": é a única gravada com old_data/new_data
 * preenchidos pelo logAuditContext; as linhas "EVENT" (logEvent) não têm
 * esses campos, então já ficariam de fora, mas o filtro deixa explícito.
 */
export function extractStatusHistory(auditRows) {
  return auditRows
    .filter((row) => row.action === "UPDATE")
    .filter((row) => {
      const before = row.old_data?.status;
      const after = row.new_data?.status;
      return after && before !== after;
    })
    .map((row) => ({
      id: row.id,
      at: row.created_at,
      from: row.old_data?.status || null,
      to: row.new_data?.status,
      by: row.changed_by_email || row.changed_by || "sistema",
      origin: row.origin,
    }));
}

/**
 * Quando o atendente foi removido (occurrence.attendant_id === null), o
 * JOIN na query principal não traz mais nada sobre quem atendeu. Essa
 * função varre o audit_log (linhas UPDATE, que têm old_data/new_data) e
 * devolve o último attendant_id que a ocorrência teve antes de virar null,
 * pra buscarmos os dados dele à parte e não perder essa informação.
 */
export function findLastKnownAttendantId(auditRows) {
  const updates = auditRows
    .filter((row) => row.action === "UPDATE")
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  let last = null;
  for (const row of updates) {
    const before = row.old_data?.attendant_id;
    const after = row.new_data?.attendant_id;
    if (after !== undefined && after !== null) {
      last = after;
    } else if (after === null && before) {
      // Foi removido nesta linha: o valor que importa é o "before".
      last = last || before;
    }
  }
  return last;
}

/** Busca os dados completos de um atendente por id (inclusive inativo/removido). */
export async function getAttendantSnapshot(attendantId) {
  if (!attendantId) return null;
  const { data, error } = await supabase
    .from("attendants")
    .select(
      `id, name, email, role, active, deleted_at, ibge_code,
       municipalities:ibge_code ( city, uf, region_id, regions:region_id ( name ) )`
    )
    .eq("id", attendantId)
    .maybeSingle();

  if (error) throw error;
  return data;
}