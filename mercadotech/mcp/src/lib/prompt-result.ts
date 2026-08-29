import type { PromptMessage } from "@modelcontextprotocol/sdk/types.js";

// Los 5 Prompts MCP (Fase 5.4) — terminología: "Prompts MCP", NUNCA
// "Skills" (lección 2, viven en el servidor, no en .claude/skills/).
// Cada uno arma dos mensajes: instrucciones (texto) + el contenido real
// embebido como resource (patrón de ReadHub) — nunca al revés, y nunca
// reimplementando recuperación: el contenido sale de las mismas funciones
// compartidas de mcp/src/shared/ y mcp/src/tools/ de la Fase 5.3.

export function instructionMessage(text: string): PromptMessage {
  return { role: "user", content: { type: "text", text } };
}

export function embeddedResourceMessage(uri: string, data: unknown): PromptMessage {
  return {
    role: "user",
    content: {
      type: "resource",
      resource: { uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) },
    },
  };
}
