import { type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Node.js en vez de Edge (default): el runtime Edge real de Vercel no
  // define `__dirname`, y next/dist/compiled/ua-parser-js (vendorizado
  // DENTRO de Next.js, se incluye siempre en cualquier middleware, no es
  // código nuestro ni de @supabase/ssr) lo referencia — confirmado
  // reproduciendo el build real de Vercel (`vercel build`) e inspeccionando
  // el bundle resultante. Nunca se manifestó en local (`next dev`/`next
  // start`) ni en CI porque ninguno ejecuta el runtime Edge real, solo lo
  // emulan. Node.js Middleware es GA desde Next.js 15.2 (estamos en
  // 15.5.23) — mismo `updateSession`, sin cambios de comportamiento.
  runtime: "nodejs",
  matcher: [
    /*
     * No correr el middleware en assets estáticos ni en archivos de imagen,
     * para no gastar cuota de refresco de sesión en requests que no la
     * necesitan.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
