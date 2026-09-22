import { supabase } from "./client";
import { logAuditContext } from "./audit";

/**
 * necessario para o RegionMap plotar os atendentes quando o usuario logado
 * for admin (o mapa do admin reaproveita os dados ja carregados na tabela,
 * sem fazer uma query separada).
 */
export async function getAllAttendants() {
  const { data, error } = await supabase
    .from("attendants")
    .select(
      `
      id,
      name,
      email,
      role,
      active,
      ibge_code,
      created_at,
      municipalities:ibge_code ( city, uf, latitude, longitude, region_id, regions:region_id ( name ) )
    `
    )
    .order("name", { ascending: true });
 
  if (error) throw error;
  return data;
}
 
/**
 * Atualiza um atendente existente (nome, role, active, ibge_code).
 * Passa pela policy "attendants_update_admin" (admin) ou "attendants_update_proprio_registro".
 * NAO usar essa funcao para trocar email/senha - isso mexe em auth.users e precisa de Edge Function.
 */
export async function updateAttendant(id, updates) {
  const { data, error } = await supabase
    .from("attendants")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  await logAuditContext({
    tableName: "attendants",
    recordId: id,
    description: `Atualizou atendente ${data.name}`,
    origin: "web",
  });

  return data;
}

/**
 * Cria um novo atendente (usuario de Auth + linha em attendants).
 * Precisa passar pela Edge Function porque mexe em auth.users (service_role).
 * O client so envia o token do admin logado, nunca a service key.
 */
export async function createAttendant({ name, email, password, role, ibge_code }) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("Sessao invalida. Faca login novamente.");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const response = await fetch(`${supabaseUrl}/functions/v1/create-attendant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ name, email, password, role, ibge_code }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.error || "Erro ao criar atendente.");
  }

  return result;
}

/**
 * Desativa/reativa um atendente (soft delete). Atalho em cima de updateAttendant.
 */
export async function setAttendantActive(id, active) {
  if (!active) {
    const { count, error: countError } = await supabase
      .from("sos")
      .select("id", { count: "exact", head: true })
      .eq("attendant_id", id)
      .in("status", ["active", "in_progress"]);

    if (countError) throw countError;
    if (count > 0) {
      throw new Error(
        "Não é possível desativar: este atendente possui ocorrências em andamento. Reatribua-as antes de desativar."
      );
    }
  }

  const { data, error } = await supabase
    .from("attendants")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  await logAuditContext({
    tableName: "attendants",
    recordId: id,
    description: active ? `Reativou atendente ${data.name}` : `Desativou atendente ${data.name}`,
    origin: "web",
  });

  return data;
}

/**
 * Deleta um atendente.
 * Retorna { deleted: boolean, deactivated: boolean, message: string }
 */
export async function deleteAttendant(id) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("Sessao invalida. Faca login novamente.");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const response = await fetch(`${supabaseUrl}/functions/v1/delete-attendant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ attendant_id: id }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.error || "Erro ao deletar atendente.");
  }

  await logAuditContext({
    tableName: "attendants",
    recordId: id,
    description: "Removeu atendente",
    origin: "web",
  });

  return result;
}



/**
 * Retorna os dados (role, ibge_code, active) do atendente atualmente logado.
 * Usado pra decidir o que o AttendantsTab/AttendantForm mostram: admin ve
 * tudo sem restricao, supervisor fica limitado a propria regiao.
 */
export async function getCurrentAttendant() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
 
  if (userError || !user) {
    throw new Error("Sessão inválida. Faça login novamente.");
  }
 
  const { data, error } = await supabase
    .from("attendants")
    .select("id, name, role, active, ibge_code")
    .eq("id", user.id)
    .single();
 
  if (error) throw error;
  return data;
}



export async function updateAttendantEmail(attendantId, newEmail) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("Sessao invalida. Faca login novamente.");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const response = await fetch(`${supabaseUrl}/functions/v1/update-attendant-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ attendant_id: attendantId, new_email: newEmail }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.error || "Erro ao atualizar email.");
  }

  await logAuditContext({
    tableName: "attendants",
    recordId: attendantId,
    description: "Alterou email do atendente",
    origin: "web",
  });

  return result;
}


export async function updateAttendantPassword(attendantId, newPassword) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("Sessao invalida. Faca login novamente.");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const response = await fetch(`${supabaseUrl}/functions/v1/update-attendant-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ attendant_id: attendantId, new_password: newPassword }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.error || "Erro ao atualizar senha.");
  }

  await logAuditContext({
    tableName: "attendants",
    recordId: attendantId,
    description: "Alterou senha do atendente",
    origin: "web",
  });

  return result;
}