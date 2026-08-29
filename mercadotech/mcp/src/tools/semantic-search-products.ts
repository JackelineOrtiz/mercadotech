import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchProducts } from "@/services/vector-search.service";
import {
  VECTOR_SEARCH_DEFAULT_TOP_K,
  VECTOR_SEARCH_MAX_TOP_K,
  VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD,
} from "@/lib/constants/ai";
import { createContext } from "../context.js";
import { safe } from "../lib/safe.js";
import { toolResult, toolError } from "../lib/tool-result.js";

// Cliente: admin (decisión 3 de la spec) — knowledge_embeddings tiene RLS
// de SELECT solo para `authenticated`; este servidor no tiene una sesión
// de usuario real que ofrecer, así que la búsqueda semántica solo funciona
// con el cliente admin. Requiere HUGGINGFACEHUB_API_TOKEN configurado —
// si falta o el modelo rotó, lib/ai/embeddings.ts lanza un mensaje
// accionable que `safe` traduce a error de tool (nunca tumba el servidor).
export function registerSemanticSearchProducts(server: McpServer): void {
  server.registerTool(
    "semantic_search_products",
    {
      title: "Buscar productos por significado",
      description:
        "Busca productos por SIGNIFICADO en vez de coincidencia literal de palabras — ej. " +
        "'audífonos para hacer ejercicio' encuentra audífonos deportivos aunque su título no " +
        "diga 'ejercicio'. Usa esta tool cuando search_products no traiga nada relevante para " +
        "una consulta descriptiva o en lenguaje natural.",
      inputSchema: {
        query: z.string().min(1).describe("Consulta en lenguaje natural."),
        topK: z
          .number()
          .int()
          .min(1)
          .max(VECTOR_SEARCH_MAX_TOP_K)
          .optional()
          .describe(`Cuántos resultados traer (por defecto ${VECTOR_SEARCH_DEFAULT_TOP_K}).`),
        threshold: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe(
            `Similitud mínima 0-1 (por defecto ${VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD}).`,
          ),
      },
    },
    safe(async ({ query, topK, threshold }) => {
      const { admin } = createContext();
      const results = await searchProducts(query, { topK, threshold }, admin);
      return toolResult(results);
    }, toolError),
  );
}
