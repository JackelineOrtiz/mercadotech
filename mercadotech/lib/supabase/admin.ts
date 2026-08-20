import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// ⚠️ ADVERTENCIA: este cliente usa la service role key y BYPASEA Row Level
// Security por completo. Solo debe usarse en código de servidor (Route
// Handlers, Server Actions, scripts) para operaciones administrativas que
// no pueden pasar por RLS. JAMÁS importar este archivo desde código que se
// ejecute en el cliente (components sin "use server", hooks, etc.) — el
// import "server-only" de arriba hace que el build falle si eso ocurre.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
