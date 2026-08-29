import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listByProduct } from "@/services/review.service";
import { createContext } from "../context.js";
import { instructionMessage, embeddedResourceMessage } from "../lib/prompt-result.js";

// Distinto de la tool summarize_reviews (5.3): esta es un FORMULARIO — solo
// embebe las reseñas reales e instrucciones, el modelo del CLIENTE hace la
// síntesis. La tool, en cambio, ya llama a lib/ai/completion y devuelve el
// resumen hecho. Mismo dato (review.service.listByProduct), dos formas
// distintas de ofrecerlo — ninguna reimplementa a la otra.
export function registerResumenDeResenas(server: McpServer): void {
  server.registerPrompt(
    "resumen_de_resenas",
    {
      title: "Resumen de reseñas",
      description: "Pros y contras de un producto según las reseñas reales de compradores.",
      argsSchema: { productId: z.string().describe("id (uuid) del producto.") },
    },
    async ({ productId }) => {
      const { anon } = createContext();
      const reviews = await listByProduct(productId, anon);

      if (reviews.length === 0) {
        return {
          messages: [
            instructionMessage(`El producto ${productId} todavía no tiene reseñas que resumir.`),
          ],
        };
      }

      // Solo rating + comment viajan al modelo — nunca buyer_id (ver
      // mismo criterio que la tool summarize_reviews, lib/ai/prompts.ts).
      const reviewsForPrompt = reviews.map((r) => ({ rating: r.rating, comment: r.comment }));

      return {
        description: `Reseñas de ${productId} (${reviews.length})`,
        messages: [
          instructionMessage(
            "Resume las reseñas reales de abajo en dos listas cortas: 'Pros' y 'Contras', " +
              "según lo que digan los propios compradores. Reglas estrictas: basa el resumen " +
              "ÚNICAMENTE en el rating y el comentario de cada reseña (nunca inventes opiniones " +
              "que no estén ahí); si son pocas o contradictorias, dilo con honestidad; nunca " +
              "menciones quién escribió cada una — no tienes esa información.",
          ),
          embeddedResourceMessage(`mercadotech://products/${productId}`, reviewsForPrompt),
        ],
      };
    },
  );
}
