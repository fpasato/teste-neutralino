import { supabase } from './client';

export async function fetchOccurrencesByMunicipality(ibgeCode) {
  const { data, error } = await supabase
    .from('sos')
    .select('id, latitude, longitude, status, created_at, closed_at, attendant_id, city, uf, ibge_code')
    .eq('ibge_code', ibgeCode)
    .in('status', ['active', 'in_progress', 'unresolved'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Ocorrências abertas de vários municípios (região inteira).
 * Recebe a lista de ibge_codes já resolvida (ex: via getMunicipalitiesByRegion).
 */
export async function fetchOccurrencesByIbgeCodes(ibgeCodes) {
  if (!ibgeCodes || ibgeCodes.length === 0) return [];

  const { data, error } = await supabase
    .from('sos')
    .select('id, latitude, longitude, status, created_at, closed_at, attendant_id, city, uf, ibge_code')
    .in('ibge_code', ibgeCodes)
    .in('status', ['active', 'in_progress', 'unresolved'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Todas as ocorrências abertas do sistema (admin, sem filtro de região).
 */
export async function fetchAllOccurrences() {
  const { data, error } = await supabase
    .from('sos')
    .select('id, latitude, longitude, status, created_at, closed_at, attendant_id, city, uf, ibge_code')
    .in('status', ['active', 'in_progress', 'unresolved'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Inscreve-se no Realtime para SOS.
 * - ibgeCodes = null  -> sem filtro, recebe tudo (admin vendo "todas as regiões")
 * - ibgeCodes = [X]   -> um único município (comportamento antigo)
 * - ibgeCodes = [X,Y] -> vários municípios (região). O Postgres Realtime não
 *   suporta filtro "in" no channel, então aqui assinamos sem filtro de coluna
 *   e filtramos no client.
 */
export function subscribeToOccurrences(ibgeCodes, callbacks) {
  const channelName = ibgeCodes
    ? `sos-${ibgeCodes.slice().sort().join('-')}`
    : 'sos-all';

  const matches = (row) => !ibgeCodes || ibgeCodes.includes(row.ibge_code);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sos' },
      (payload) => {
        const row = payload.new ?? payload.old;
        if (!matches(row)) return;

        if (payload.eventType === 'INSERT') callbacks.onInsert?.(payload.new);
        if (payload.eventType === 'UPDATE') callbacks.onUpdate?.(payload.new);
        if (payload.eventType === 'DELETE') callbacks.onDelete?.(payload.old);
      }
    )
    .subscribe();

  return channel;
}

export function unsubscribeFromOccurrences(channel) {
  if (channel) supabase.removeChannel(channel);
}

export async function assumeOccurrence(occurrenceId, attendantId) {
  const { error } = await supabase
    .from('sos')
    .update({
      status: 'in_progress',
      attendant_id: attendantId,
      dispatched_at: new Date().toISOString(),
    })
    .eq('id', occurrenceId);

  if (error) throw error;
}

export async function fetchAttendantMunicipality(attendantId) {
  const { data, error } = await supabase
    .from('attendants')
    .select('ibge_code, role, municipalities ( ibge_code, city, uf, latitude, longitude, region_id )')
    .eq('id', attendantId)
    .single();

  if (error) throw error;
  return data;
}