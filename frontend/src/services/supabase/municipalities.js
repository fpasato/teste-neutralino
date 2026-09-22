// services/supabase/municipalityService.js
import { supabase } from "./client";

export async function searchMunicipalities(query) {
  if (!query || query.length < 2) return [];

  const { data, error } = await supabase
    .from("municipalities")
    .select("ibge_code, city, uf")
    .ilike("city", `%${query}%`)
    .order("city")
    .limit(15);

  if (error) throw error;
  return data;
}

/**
 * Lista todos os municipios de uma regiao (com lat/lng), usado para:
 * - restringir o select de municipio no AttendantForm quando quem esta
 *   logado e supervisor
 * - desenhar os marcadores no RegionMap
 */
export async function getMunicipalitiesByRegion(regionId) {
  if (!regionId) return [];

  const { data, error } = await supabase
    .from("municipalities")
    .select("ibge_code, city, uf, latitude, longitude, region_id")
    .eq("region_id", regionId)
    .order("city", { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Resolve o region_id (e nome da regiao) a partir do ibge_code de um
 * municipio. Usado para descobrir a regiao do supervisor logado a partir
 * do attendants.ibge_code dele.
 */
export async function getRegionByIbgeCode(ibgeCode) {
  if (!ibgeCode) return null;

  const { data, error } = await supabase
    .from("municipalities")
    .select("region_id, regions:region_id ( id, name )")
    .eq("ibge_code", ibgeCode)
    .single();

  if (error) throw error;
  return data?.regions || null; // { id, name }
}

/**
 * Lista todas as regiões disponíveis.
 */
export async function getAllRegions() {
  const { data, error } = await supabase
    .from("regions")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw error;
  return data;
}

