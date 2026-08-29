import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getProductById, getProductImages } from "@/services/product.service";
import { getAverage } from "@/services/review.service";
import { listByProduct } from "@/services/question.service";
import { createContext } from "../context.js";
import { safe } from "../lib/safe.js";
import { toolResult, toolError } from "../lib/tool-result.js";
import { isPostgrestNotFoundError } from "../lib/errors.js";
import { NotFoundError } from "../lib/errors.js";

// Cliente: anon — detalle de producto, imágenes, promedio de reseñas y
// preguntas/respuestas son todos públicos (mismos datos que /producto/[id]
// en la web). Ningún dato de comprador: getAverage solo agrega ratings,
// listByProduct expone question/answer con user_id como id opaco (igual
// que la web, que tampoco resuelve nombres — profiles sin SELECT público).
export function registerGetProduct(server: McpServer): void {
  server.registerTool(
    "get_product",
    {
      title: "Obtener detalle de un producto",
      description:
        "Trae el detalle completo de un producto activo por su id: título, precio, condición, " +
        "descripción, imágenes, promedio de reseñas y preguntas/respuestas públicas.",
      inputSchema: {
        productId: z.string().describe("id (uuid) del producto."),
      },
    },
    safe(async ({ productId }) => {
      const { anon } = createContext();

      let product;
      try {
        product = await getProductById(productId, anon);
      } catch (err) {
        if (isPostgrestNotFoundError(err)) {
          throw new NotFoundError(`producto ${productId}`);
        }
        throw err;
      }

      const [images, rating, questions] = await Promise.all([
        getProductImages(productId, anon),
        getAverage(productId, anon),
        listByProduct(productId, anon),
      ]);

      return toolResult({ product, images, rating, questions });
    }, toolError),
  );
}
