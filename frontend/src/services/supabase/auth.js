import { supabase } from "./client";
import { logEvent } from "./audit";

export async function signUp({ name, email, password, ibge_code }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw error;

  const userId = data.user?.id;
  if (!userId) throw new Error("Usuário não retornado após cadastro.");

  const { error: attendantError } = await supabase.from("attendants").insert({
    id: userId,
    name,
    email,
    role: "attendant",
    ibge_code,
  });

  if (attendantError) throw attendantError;

  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  const userId = data.user?.id;
  if (userId) {
    const { data: attendant } = await supabase
      .from("attendants")
      .select("active")
      .eq("id", userId)
      .single();

    if (attendant && attendant.active === false) {
      await supabase.auth.signOut();
      throw new Error("Sua conta está desativada. Contate um administrador.");
    }

    await logEvent({
      tableName: "attendants",
      recordId: userId,
      eventType: "LOGIN",
      description: `Login realizado (${email})`,
    });
  }

  return data;
}

export async function signOut() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;

  if (user) {
    await logEvent({
      tableName: "attendants",
      recordId: user.id,
      eventType: "LOGOUT",
      description: `Logout realizado (${user.email})`,
    });
  }

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentAttendant() {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("attendants")
    .select(
      "*, municipalities ( ibge_code, city, uf, latitude, longitude, region_id, regions:region_id ( id, name ) )",
    )
    .eq("id", userId)
    .single();

  if (error) return null;
  return data;
}
