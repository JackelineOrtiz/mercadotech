import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getProductById } from "@/services/product.service";
import { createContext } from "../context.js";
import { isPostgrestNotFoundError } from "../lib/errors.js";
import { instructionMessage, embeddedResourceMessage } from "../lib/prompt-result.js";

export function registerDescribirProducto(server: McpServer): void {
  server.registerPrompt(
    "describir_producto",
    {
      title: "Describir un producto",
      description:
        "Redacta una ficha de producto atractiva y FIEL a los datos reales — nunca inventa " +
        "especificaciones ni stock.",
      argsSchema: { productId: z.string().describe("id (uuid) del producto.") },
    },
    async ({ productId }) => {
      const { anon } = createContext();

      let product;
      try {
        product = await getProductById(productId, anon);
      } catch (err) {
        if (!isPostgrestNotFoundError(err)) throw err;
        return {
          messages: [
            instructionMessage(
              `No se encontró el producto ${productId} — no hay ficha real que describir.`,
            ),
          ],
        };
      }

      return {
        description: `Ficha del producto: ${product.title}`,
        messages: [
          instructionMessage(
            "Redacta una ficha de producto para MercadoTech, en español: atractiva pero " +
              "FIEL. Reglas estrictas: usa ÚNICAMENTE los datos del producto que aparece " +
              "abajo (nunca inventes especificaciones, materiales ni stock que no estén " +
              "ahí); si falta un dato, omítelo en vez de suponerlo; 3-4 frases, tono cercano " +
              "y profesional. Si necesitas compararlo con otros productos o citar reseñas " +
              "reales, usa las tools compare_products o summarize_reviews de este mismo " +
              "servidor en vez de inventar.",
          ),
          embeddedResourceMessage(`mercadotech://products/${product.id}`, product),
        ],
      };
    },
  );
}
