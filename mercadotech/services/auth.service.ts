import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { UserRole } from "@/lib/constants/roles";
import type { Profile } from "@/types/user";

type Client = SupabaseClient<Database>;

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}

// display_name y role van en options.data del signUp — el trigger
// handle_new_user (Fase 3.3) los lee de raw_user_meta_data al crear el
// profile. NUNCA se hace un update a profiles después: protect_profiles_role
// (Fase 2.3) bloquearía el cambio de role igual, así que sería inútil.
export async function register(
  { email, password, displayName, role }: RegisterInput,
  supabase: Client = createClient(),
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, role },
    },
  });
  if (error) throw error;
  return data;
}

export async function login(
  email: string,
  password: string,
  supabase: Client = createClient(),
) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function logout(supabase: Client = createClient()) {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Usuario de auth.users + su fila de profiles. null si no hay sesión.
export async function getCurrentUser(
  supabase: Client = createClient(),
): Promise<Profile | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (profileError) throw profileError;

  return profile as Profile;
}
