import { createClient } from "@/lib/supabase/client";
import { getPublicUrl } from "@/services/storage.service";
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

// Hallazgo real del code-reviewer al construir "Mi perfil": updatePassword
// (arriba) no pide la contraseña actual porque en /actualizar-contrasena el
// link del correo YA es la prueba de identidad — pero llamado desde una
// sesión ambiente normal (perfil de cuenta), eso dejaría cambiar la
// contraseña sin saber la anterior (riesgo real: navegador compartido, XSS,
// dispositivo desatendido). signInWithPassword con la contraseña actual
// reautentica antes de tocar nada; si falla, updateUser ni se llama.
export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (reauthError) throw reauthError;

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export interface UpdateProfileInput {
  displayName: string;
  phone: string;
}

// UPDATE de profiles: RLS (profiles_update_own, Fase 2.3) ya restringe a
// "solo mi propia fila", y el GRANT de columnas solo expone display_name/
// phone/avatar_path — un intento de colar "role" acá ni siquiera llegaría,
// pero de todos modos no se ofrece en el input porque no es de este
// formulario. phone vacío se guarda como null (columna nullable), no como
// string vacío, para no ensuciar futuras validaciones de "¿tiene teléfono?".
export async function updateProfile(
  userId: string,
  { displayName, phone }: UpdateProfileInput,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName.trim(), phone: phone.trim() || null })
    .eq("id", userId);
  if (error) throw error;
}

// Separado de updateProfile: subir el archivo (storage.service.uploadAvatar)
// y guardar el path son dos pasos con dos posibles puntos de falla — el
// caller (hook) decide el orden y puede reintentar el segundo paso sin
// volver a subir el archivo si el UPDATE fallara.
export async function updateAvatarPath(
  userId: string,
  avatarPath: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: avatarPath })
    .eq("id", userId);
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

  if (!profile) return { user, profile: null };

  // Bug real encontrado al construir "Mi perfil" (pantalla fuera del PDF):
  // hasta ahora avatar_path siempre era null en el seed, así que nadie
  // notó que UserMenu intentaba usarlo directo como src de <img> — un path
  // de Storage crudo, no una URL. Se resuelve acá, mismo patrón que
  // product.service con image_url, para que ya nunca vuelva a pasar.
  const avatar_url = profile.avatar_path
    ? getPublicUrl("avatars", profile.avatar_path, supabase)
    : null;

  return { user, profile: { ...(profile as Profile), avatar_url } };
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
