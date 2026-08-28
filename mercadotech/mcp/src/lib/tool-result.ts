import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Formateo consistente del resultado de una tool (Fase 5.3): `content` es
// el texto que lee el modelo, `structuredContent` es el mismo dato como
// JSON para quien quiera parsearlo sin re-leer el texto. Si `data` no es
// un objeto plano (ej. un array o un primitivo), se envuelve en
// `{ result: data }` — structuredContent del protocolo exige un objeto.
export function toolResult(data: unknown, text?: string): CallToolResult {
  const rendered = text ?? JSON.stringify(data, null, 2);
  return {
    content: [{ type: "text", text: rendered }],
    structuredContent: isRecord(data) ? data : { result: data },
  };
}

// Resultado de error de una tool: `isError: true` es lo que el protocolo
// espera para que el cliente MCP sepa que la tool falló sin que el
// servidor se caiga (lección 7 aplicada a tools).
export function toolError(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
