import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createContext } from "../context.js";
import { safe } from "../lib/safe.js";
import { toolResult, toolError } from "../lib/tool-result.js";
import { isPostgrestNotFoundError, NotFoundError } from "../lib/errors.js";
import { getProductDetail } from "../shared/products.js";

// Cliente: anon — detalle de producto, imágenes, promedio de reseñas y
// preguntas/respuestas son todos públicos (mismos datos que /producto/[id]
// en la web). Ningún dato de comprador: getAverage solo agrega ratings,
// listByProduct expone question/answer con user_id como id opaco (igual
// que la web, que tampoco resuelve nombres — profiles sin SELECT público).
//
// La lógica de fetch vive en shared/products.ts (getProductDetail),
// compartida con el resource mercadotech://products/{id} de la Fase 5.4 —
// no se duplica acá.
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
      try {
        const detail = await getProductDetail(productId, anon);
        return toolResult(detail);
      } catch (err) {
        if (isPostgrestNotFoundError(err)) {
          throw new NotFoundError(`producto ${productId}`);
        }
        throw err;
      }
    }, toolError),
  );
}
