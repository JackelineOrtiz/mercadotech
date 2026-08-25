import { NextResponse } from "next/server";

// Forma de error consistente para los 3 Route Handlers de la Sesión 4
// (/api/v1/reindex, /search/semantic, /chat) — un cliente que recibe un
// error siempre puede leer error.code sin parsear el mensaje.
export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}
