import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listByProduct } from "@/services/review.service";
import { generateCompletion } from "@/lib/ai/completion";
import { REVIEW_SUMMARY_SYSTEM_INSTRUCTIONS } from "@/lib/ai/prompts";
import { createContext } from "../context.js";
import { safe } from "../lib/safe.js";
import { toolResult, toolError } from "../lib/tool-result.js";

// Cliente: anon — reviews_select_all las hace públicas. Solo rating y
// comment viajan al modelo: buyer_id (el único campo con algo de identidad,
// un uuid opaco) NUNCA se le pasa al prompt — ver REVIEW_SUMMARY_SYSTEM_
// INSTRUCTIONS en lib/ai/prompts.ts.
export function registerSummarizeReviews(server: McpServer): void {
  server.registerTool(
    "summarize_reviews",
    {
      title: "Resumir reseñas de un producto",
      description:
        "Resume las reseñas reales de un producto en pros y contras — útil para responder " +
        "'¿qué dicen los que ya lo compraron?' sin tener que leer cada reseña.",
      inputSchema: {
        productId: z.string().describe("id (uuid) del producto."),
      },
    },
    safe(async ({ productId }) => {
      const { anon } = createContext();
      const reviews = await listByProduct(productId, anon);

      if (reviews.length === 0) {
        return toolResult(
          { productId, reviewCount: 0, summary: null },
          "Este producto todavía no tiene reseñas.",
        );
      }

      const reviewsText = reviews
        .map((r, i) => `${i + 1}. Calificación: ${r.rating}/5. Comentario: ${r.comment ?? "(sin comentario)"}`)
        .join("\n");
      const userMessage = `Reseñas del producto (${reviews.length} en total):\n${reviewsText}`;

      const completion = await generateCompletion(REVIEW_SUMMARY_SYSTEM_INSTRUCTIONS, userMessage);

      return toolResult(
        { productId, reviewCount: reviews.length, summary: completion.text },
        completion.text,
      );
    }, toolError),
  );
}
