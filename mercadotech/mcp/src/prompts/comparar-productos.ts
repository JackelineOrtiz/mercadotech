import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getProductsByIds } from "@/services/product.service";
import { createContext } from "../context.js";
import { instructionMessage, embeddedResourceMessage } from "../lib/prompt-result.js";

// Argumento como string separado por comas (no array): los argumentos de
// un Prompt MCP viajan como Record<string,string> por el protocolo — un
// array no es una forma válida de argumento MCP.
export function registerCompararProductos(server: McpServer): void {
  server.registerPrompt(
    "comparar_productos",
    {
      title: "Comparar productos",
      description: "Tabla comparativa entre 2 y 4 productos reales + recomendación por perfil de uso.",
      argsSchema: {
        ids: z.string().describe("ids (uuid) separados por coma, entre 2 y 4 productos."),
      },
    },
    async ({ ids }) => {
      const productIds = [...new Set(ids.split(",").map((id) => id.trim()).filter(Boolean))];

      if (productIds.length < 2 || productIds.length > 4) {
        return {
          messages: [
            instructionMessage(
              `Se pidieron ${productIds.length} ids distintos ("${ids}") — comparar_productos ` +
                "necesita entre 2 y 4.",
            ),
          ],
        };
      }

      const { anon } = createContext();
      const products = await getProductsByIds(productIds, anon);

      if (products.length < 2) {
        return {
          messages: [
            instructionMessage(
              `Solo se encontraron ${products.length} de los ${productIds.length} productos ` +
                "pedidos — no hay suficientes datos reales para comparar.",
            ),
          ],
        };
      }

      return {
        description: `Comparación de ${products.length} productos`,
        messages: [
          instructionMessage(
            "Compara los productos de abajo en una tabla (precio, condición, marca, stock) y " +
              "cierra con una recomendación de 2-3 líneas según distintos perfiles de uso " +
              "('para uso diario', 'para gaming', etc.). Reglas estrictas: usa ÚNICAMENTE los " +
              "datos que aparecen abajo, nunca inventes especificaciones que no estén ahí; si " +
              "necesitas el rating real de cada uno, usa la tool compare_products de este mismo " +
              "servidor en vez de suponerlo.",
          ),
          embeddedResourceMessage(`mercadotech://products?ids=${productIds.join(",")}`, products),
        ],
      };
    },
  );
}
