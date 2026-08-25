import { NextResponse } from "next/server";

// Forma de error consistente para los 3 Route Handlers de la Sesión 4
// (/api/v1/reindex, /search/semantic, /chat) — un cliente que recibe un
// error siempre puede leer error.code sin parsear el mensaje.
export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Los errores de Postgrest (embedding.service, vector-search.service) son
// objetos planos {message, details, hint, code}, NO instancias de Error —
// String(err) sobre ellos da el inútil "[object Object]" (encontrado real
// al construir la Fase 4.3). Se extrae .message explícitamente antes de
// caer a String() — compartido por los 3 endpoints de la sesión.
export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}
