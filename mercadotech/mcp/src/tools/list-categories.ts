import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createContext } from "../context.js";
import { safe } from "../lib/safe.js";
import { toolResult, toolError } from "../lib/tool-result.js";
import { getCategoriesWithCount } from "../shared/stats.js";

// Cliente: anon — categorías son públicas. El conteo por categoría es una
// derivación (mcp/src/shared/stats.ts, lección 6), no un service nuevo.
export function registerListCategories(server: McpServer): void {
  server.registerTool(
    "list_categories",
    {
      title: "Listar categorías",
      description:
        "Lista todas las categorías del catálogo con el número de productos activos que tiene " +
        "cada una — útil para saber qué slug pasarle a search_products o para orientar a un " +
        "comprador que no sabe bien qué busca.",
      inputSchema: {},
    },
    safe(async () => {
      const { anon } = createContext();
      const categories = await getCategoriesWithCount(anon);
      return toolResult(categories);
    }, toolError),
  );
}
