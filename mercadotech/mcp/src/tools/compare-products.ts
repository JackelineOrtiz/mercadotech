import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getProductsByIds } from "@/services/product.service";
import { getAverage } from "@/services/review.service";
import { createContext } from "../context.js";
import { safe } from "../lib/safe.js";
import { toolResult, toolError } from "../lib/tool-result.js";
import { InvalidInputError } from "../lib/errors.js";

// Cliente: anon — mismos datos públicos que get_product, para 2-4 ids a
// la vez. getProductsByIds se agregó a services/product.service.ts en esta
// fase (la spec la daba por existente; no estaba — Prompt 1 lo reportó
// como bloqueo).
export function registerCompareProducts(server: McpServer): void {
  server.registerTool(
    "compare_products",
    {
      title: "Comparar productos",
      description:
        "Compara entre 2 y 4 productos lado a lado: precio, condición, marca, stock y " +
        "calificación promedio — para responder '¿cuál me conviene entre estos?'.",
      inputSchema: {
        productIds: z
          .array(z.string())
          .min(2, "Se necesitan al menos 2 ids para comparar.")
          .max(4, "Como máximo 4 productos a la vez.")
          .describe("ids (uuid) de los productos a comparar."),
      },
    },
    safe(async ({ productIds }) => {
      const uniqueIds = [...new Set(productIds)];
      if (uniqueIds.length < 2) {
        throw new InvalidInputError("Se necesitan al menos 2 productos DISTINTOS para comparar.");
      }

      const { anon } = createContext();
      const [products, ratings] = await Promise.all([
        getProductsByIds(uniqueIds, anon),
        Promise.all(uniqueIds.map((id) => getAverage(id, anon))),
      ]);

      const productsById = new Map(products.map((p) => [p.id, p]));
      const ratingById = new Map(uniqueIds.map((id, i) => [id, ratings[i]]));

      // Preserva el orden en que se pidieron, no el orden de la base —
      // getProductsByIds no lo garantiza (.in() no ordena).
      const comparison = uniqueIds.map((id) => {
        const product = productsById.get(id);
        if (!product) return { productId: id, found: false as const };
        const rating = ratingById.get(id)!;
        return {
          productId: id,
          found: true as const,
          title: product.title,
          brand: product.brand,
          price: product.price,
          condition: product.condition,
          stock: product.stock,
          averageRating: rating.average,
          reviewCount: rating.count,
        };
      });

      return toolResult(comparison);
    }, toolError),
  );
}
