// Errores tipados para las tools/resources de las Fases 5.3-5.4 — evitan
// que un error crudo de Postgres o de fetch llegue como stack trace al
// cliente MCP.

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`No se encontró: ${what}`);
    this.name = "NotFoundError";
  }
}

export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInputError";
  }
}

// Para cuando falla Hugging Face (token, modelo rotado, cuota excedida) —
// lib/ai/embeddings.ts y completion.ts ya traducen esos casos a mensajes
// accionables; esta clase solo marca que el fallo es del PROVEEDOR
// externo, no un bug del servidor (Fase 5.3, tools #4/#5/#7/#8).
export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

// Los errores de PostgREST/Postgrest-js (embedding.service, product.service,
// etc.) son objetos planos {message, details, hint, code}, NO instancias de
// Error — String(err) sobre ellos da el inútil "[object Object]" (mismo
// hallazgo real de la Fase 4.3, documentado en docs/BITACORA.md). Esta
// función ya existe una vez consolidada en lib/api-response.ts — no se
// reutiliza desde ahí porque ese archivo importa "next/server"
// (NextResponse), fuera de lo que mcp/ puede importar (solo services/,
// lib/ai/, lib/constants/, types/): se duplica esta única función pura de
// 6 líneas a propósito, mismo criterio que ya se aplicó 3 veces en la
// Sesión 4 antes de consolidarla para los Route Handlers.
// PGRST116 = PostgREST "0 filas" en un .single() — mismo código que ya usa
// services/embedding.service.ts (isSourceNotFoundError, Fase 4.3). No se
// reutiliza esa función tal cual porque su nombre y su comentario son
// específicos de fichas de knowledge_embeddings; esta es la misma
// comprobación genérica de protocolo (cualquier lookup por id con
// .single()), reutilizada por get_product, get_order_status, etc.
export function isPostgrestNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "PGRST116"
  );
}

export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}
