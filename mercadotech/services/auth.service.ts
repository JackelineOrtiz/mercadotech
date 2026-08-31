import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient, User } from "@supabase/supabase-js";
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

// Supabase NO revela si el correo existe (mismo comportamiento con éxito
// o error "no encontrado" internamente) — la UI siempre debe mostrar el
// mismo mensaje de confirmación, nunca "ese correo no existe" (evita que
// alguien use este formulario para enumerar cuentas reales).
export async function requestPasswordReset(
  email: string,
  supabase: Client = createClient(),
): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    // Sin esto, un despliegue sin la variable mandaría el correo real
    // igual, pero con un link roto ("undefined/actualizar-contrasena") —
    // falla acá, antes de disparar el correo, en vez de silenciosamente.
    throw new Error("NEXT_PUBLIC_SITE_URL no está configurada.");
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/actualizar-contrasena`,
  });
  if (error) throw error;
}

// Solo funciona con la sesión de recuperación que Supabase establece al
// abrir el link del correo (@supabase/ssr detecta el token de la URL
// automáticamente, detectSessionInUrl: true por defecto) — llamarlo sin
// esa sesión falla con el error real de Supabase (sesión ausente).
export async function updatePassword(
  password: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

// Usuario de auth.users + su fila de profiles, en un solo viaje para
// useAuth. Errores silenciados igual que antes de moverlo aquí (Fase 3.8:
// useAuth llamaba a supabase directo desde el hook, violando la regla de
// capas — este service existe para que deje de hacerlo, sin cambiar el
// comportamiento). null solo si no hay sesión; si hay user pero el fetch
// del profile falla, profile queda en null y user sigue presente.
export async function getSession(
  supabase: Client = createClient(),
): Promise<{ user: User; profile: Profile | null } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { user, profile: (profile as Profile) ?? null };
}

// Envuelve onAuthStateChange para que useAuth no necesite tocar
// @/lib/supabase directamente. Devuelve la función de limpieza lista para
// el return de un useEffect.
export function onAuthStateChange(
  callback: () => void,
  supabase: Client = createClient(),
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}
