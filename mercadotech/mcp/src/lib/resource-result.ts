import type { ReadResourceResult, ListResourcesResult } from "@modelcontextprotocol/sdk/types.js";
import { toErrorMessage } from "./errors.js";

export function resourceJson(uri: string, data: unknown): ReadResourceResult {
  return {
    contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }],
  };
}

// Exportada además de usarse internamente en safeRead: seller.ts la usa
// directo para su caso "vendedor no encontrado" (maybeSingle() no lanza,
// solo devuelve null — no hay excepción que safeRead pueda atrapar).
export function resourceError(uri: string, message: string): ReadResourceResult {
  return { contents: [{ uri, mimeType: "text/plain", text: `Error: ${message}` }] };
}

function emptyResourceList(): ListResourcesResult {
  return { resources: [] };
}

// Wrapper de lectura (lección 7): un resource individual que falla nunca
// debe tumbar la conexión — devuelve su propio error como CONTENIDO
// legible, con el mismo uri que se pidió. Distinto de safe() de tools.ts:
// ahí no hay "uri" que devolver, así que el error se arma distinto.
export function safeRead<Args extends [URL, ...unknown[]]>(
  handler: (...args: Args) => Promise<ReadResourceResult>,
): (...args: Args) => Promise<ReadResourceResult> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      return resourceError(args[0].href, toErrorMessage(err));
    }
  };
}

// Wrapper del callback `list` de un ResourceTemplate (lección 7, la otra
// mitad): si enumerar las instancias reales falla (ej. Supabase caído),
// resources/list completo NO puede caerse por eso — se degrada a "sin
// instancias" en vez de propagar el error. El fallo queda en stderr (ya
// redirigido, nunca stdout).
export function safeList<Args extends unknown[]>(
  handler: (...args: Args) => Promise<ListResourcesResult>,
): (...args: Args) => Promise<ListResourcesResult> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error(`[resource list] ${toErrorMessage(err)}`);
      return emptyResourceList();
    }
  };
}
