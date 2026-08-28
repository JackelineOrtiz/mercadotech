import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// No se importa lib/supabase/admin.ts. Ese archivo empieza con
// `import "server-only"` — un paquete que solo actúa como no-op DENTRO del
// bundler de Next.js (webpack/turbopack lo intercambia por una versión
// vacía según el target de build); corrido bajo tsx/Node puro (como corre
// este servidor MCP) su import lanza incondicionalmente
// ("This module cannot be imported from a Client Component module"). La
// prueba de esto YA está escrita en este mismo repo: scripts/index-all.ts
// (Fase 4.3) documenta en su cabecera exactamente este fallo y su
// solución — el mismo patrón se reutiliza aquí en vez de reimportar
// admin.ts: un cliente admin propio, construido directo con
// @supabase/supabase-js (decisión 1 de la spec de esta sesión).
//
// Node 20 (el de este proyecto) no expone WebSocket global — llega recién
// en Node 22 — y @supabase/supabase-js instancia su RealtimeClient interno
// de forma EAGER en el constructor aunque nunca se llame a .channel(): sin
// este stub, createClient() lanza "Node.js detected but native WebSocket
// not found" apenas se invoca (mismo bug que index-all.ts sufrió y ya
// resolvió). Ninguno de los dos clientes de este contexto suscribe
// canales — el stub solo evita la resolución eager del transporte.
class NoopWebSocketTransport {}

export interface McpContext {
  anon: SupabaseClient<Database>;
  admin: SupabaseClient<Database>;
}

// Fábrica POR LLAMADA (lección 5), no singleton al arrancar el proceso: el
// servidor puede vivir horas atendiendo múltiples invocaciones de tools;
// crear los clientes en cada llamada evita que credenciales o conexiones
// queden congeladas desde el arranque. El costo de crear un cliente
// supabase-js es bajo (no abre conexión hasta el primer request).
export function createContext(): McpContext {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const realtime = { transport: NoopWebSocketTransport as unknown as typeof WebSocket };
  const auth = { autoRefreshToken: false, persistSession: false };

  const anon = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth,
    realtime,
  });

  const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth,
    realtime,
  });

  return { anon, admin };
}
