import { supabase } from "./client";

export async function getAllProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      name,
      cpf,
      birth_date,
      phone,
      email,
      created_at,
      sos(id, status, created_at, city, uf)
    `)
    .order("name", { ascending: true });

  if (error) throw error;

  return data.map((profile) => {
    const sosList = profile.sos || [];
    const sortedSos = [...sosList].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    return {
      ...profile,
      sosCount: sosList.length,
      lastSos: sortedSos[0] || null,
    };
  });
}