import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

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

export async function updateSession(request: NextRequest) {
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
