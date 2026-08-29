import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ask } from "@/services/chat.service";
import { createContext } from "../context.js";
import { safe } from "../lib/safe.js";
import { toolResult, toolError } from "../lib/tool-result.js";

// Cliente: admin — mismo motivo que semantic_search_products: ask() pasa
// por searchByEmbedding sobre knowledge_embeddings, RLS solo authenticated.
// Reutiliza chat.service.ask tal cual (el mismo orquestador que usan
// /asistente y /soporte en la web) — misma calidad de respuesta, mismas
// fuentes citadas.
export function registerAskAssistant(server: McpServer): void {
  server.registerTool(
    "ask_assistant",
    {
      title: "Preguntarle al asistente de compras o soporte",
      description:
        "Le hace una pregunta en lenguaje natural al asesor de compras (modo 'compras', " +
        "recomienda productos reales del catálogo citando fuentes) o al asistente de soporte " +
        "(modo 'soporte', responde con la FAQ real y sugiere abrir un ticket si no sabe). " +
        "Responde ÚNICAMENTE con información real de MercadoTech — nunca inventa.",
      inputSchema: {
        query: z.string().min(1).describe("Pregunta del usuario."),
        mode: z.enum(["compras", "soporte"]).describe("Qué asistente responde."),
      },
    },
    safe(async ({ query, mode }) => {
      const { admin } = createContext();
      const result = await ask(query, mode, {}, admin);
      return toolResult(result, result.answer);
    }, toolError),
  );
}
