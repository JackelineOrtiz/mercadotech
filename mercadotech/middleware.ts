import { type NextRequest, NextResponse } from "next/server.js";
import { createServerClient } from "@supabase/ssr";

// updateSession vivía en lib/supabase/middleware.ts (mismo patrón que los
// otros 3 clientes de Supabase — client/server/admin, ver CLAUDE.md). Se
// fusionó ACÁ, en un solo archivo, por una limitación real confirmada del
// output de "Node.js Middleware" de Next.js 15.5.23 (Fase 7.4): a
// diferencia del runtime Edge (que arma un único bundle), este target NO
// bundlea — deja middleware.ts y sus imports relativos como archivos JS
// separados, pero sin agregarles la extensión `.js` que el resolutor ESM
// real de Node exige (el package.json del proyecto necesita `"type":
// "module"` para que el runtime real de Vercel no reviente con "Cannot
// use import statement outside a module" — eso también se descubrió acá).
// Escribir el import fuente CON `.js` (`./lib/supabase/middleware.js`,
// como pide Node) rompe el build real de Webpack ("Module not found"),
// que espera la ruta SIN extensión apuntando al `.ts`. Ambos requisitos
// son incompatibles entre sí para dos archivos separados — confirmado
// reproduciendo el pipeline real de Vercel (`vercel build`) en cada
// combinación. Con todo en un solo archivo, el problema desaparece: no
// hay ningún import relativo propio que el resolutor de ninguno de los
// dos lados tenga que resolver.

// /producto NO está aquí a propósito: el detalle de producto es público
// (RLS ya lo permite para anon); solo las ACCIONES dentro de esa pantalla
// (preguntar, favorito, agregar al carrito) requieren sesión, y eso lo
// resuelve cada componente mostrando el botón de login, no el middleware.
const PROTECTED_PREFIXES = [
  "/carrito",
  "/pedidos",
  "/favoritos",
  "/vendedor",
  "/asistente",
  "/soporte",
  "/perfil",
  "/admin",
];

function requiresAuth(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // No agregar lógica entre createServerClient y getUser(): cualquier
  // código en medio puede provocar un refresco de sesión inconsistente
  // (patrón oficial de @supabase/ssr).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && requiresAuth(request.nextUrl.pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

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
