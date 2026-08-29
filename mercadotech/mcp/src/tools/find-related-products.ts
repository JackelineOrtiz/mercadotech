import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getProductById, getProductsByIds } from "@/services/product.service";
import { listCategories } from "@/services/category.service";
import { generateEmbedding, buildProductEmbeddingText } from "@/lib/ai/embeddings";
import { searchByEmbedding } from "@/services/vector-search.service";
import { VECTOR_SEARCH_DEFAULT_TOP_K } from "@/lib/constants/ai";
import { createContext } from "../context.js";
import { safe } from "../lib/safe.js";
import { toolResult, toolError } from "../lib/tool-result.js";
import { isPostgrestNotFoundError, NotFoundError } from "../lib/errors.js";

// Cliente: mixto y explícito por sub-llamada (decisión 8: nunca confiar en
// el default de un service). El producto de partida y la categoría son
// públicos → anon. searchByEmbedding lee knowledge_embeddings (RLS solo
// authenticated) → admin, igual que semantic_search_products.
export function registerFindRelatedProducts(server: McpServer): void {
  server.registerTool(
    "find_related_products",
    {
      title: "Encontrar productos relacionados",
      description:
        "Dado un producto, encuentra otros semánticamente parecidos ('más como este') — útil " +
        "para sugerir alternativas o complementos cuando el usuario ya está mirando un producto.",
      inputSchema: {
        productId: z.string().describe("id (uuid) del producto de partida."),
        topK: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe(`Cuántos relacionados traer (por defecto ${VECTOR_SEARCH_DEFAULT_TOP_K}).`),
      },
    },
    safe(async ({ productId, topK }) => {
      const { anon, admin } = createContext();
      const limit = topK ?? VECTOR_SEARCH_DEFAULT_TOP_K;

      let product;
      try {
        product = await getProductById(productId, anon);
      } catch (err) {
        if (isPostgrestNotFoundError(err)) throw new NotFoundError(`producto ${productId}`);
        throw err;
      }

      const categories = await listCategories(anon);
      const category = categories.find((c) => c.id === product.category_id);
      if (!category) throw new NotFoundError(`categoría del producto ${productId}`);

      const text = buildProductEmbeddingText(
        {
          title: product.title,
          brand: product.brand,
          condition: product.condition,
          description: product.description,
        },
        { name: category.name },
      );
      const embedding = await generateEmbedding(text);

      // +1 de margen: el propio producto casi siempre aparece como su
      // mejor match (similitud ~1) y se descarta antes de aplicar `limit`.
      const matches = await searchByEmbedding(
        embedding,
        { sourceType: "producto", topK: limit + 1 },
        admin,
      );
      const otherIds = matches
        .map((m) => m.source_id)
        .filter((id) => id !== productId)
        .slice(0, limit);
      if (otherIds.length === 0) return toolResult([]);

      const related = await getProductsByIds(otherIds, anon);
      const similarityById = new Map(matches.map((m) => [m.source_id, m.similarity]));
      const withSimilarity = related
        .map((p) => ({ ...p, similarity: similarityById.get(p.id)! }))
        .sort((a, b) => b.similarity - a.similarity);

      return toolResult(withSimilarity);
    }, toolError),
  );
}
