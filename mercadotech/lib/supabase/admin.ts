import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// ⚠️ ADVERTENCIA: este cliente usa la service role key y BYPASEA Row Level
// Security por completo. Solo debe usarse en código de servidor (Route
// Handlers, Server Actions, scripts) para operaciones administrativas que
// no pueden pasar por RLS. JAMÁS importar este archivo desde código que se
// ejecute en el cliente (components sin "use server", hooks, etc.) — el
// import "server-only" de arriba hace que el build falle si eso ocurre.
// Node < 22 no expone WebSocket global y @supabase/supabase-js instancia
// su RealtimeClient interno de forma EAGER en el constructor (incluso sin
// usar .channel() jamás) — sin este stub, createClient() puede lanzar
// "Node.js detected but native WebSocket not found" según el runtime
// (confirmado con scripts/index-all.ts corriendo en Node 20 plano; el
// Route Handler bajo `next dev` no lo sufrió, pero el mismo bug de fondo
// aplica). Este cliente nunca suscribe canales — el stub solo evita la
// resolución eager del transporte.
class NoopWebSocketTransport {}

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: { transport: NoopWebSocketTransport as unknown as typeof WebSocket },
    },
  );
}
