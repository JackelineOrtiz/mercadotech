import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createContext } from "../context.js";
import { resourceJson, safeRead } from "../lib/resource-result.js";
import { getCategoriesWithCount } from "../shared/stats.js";

// Cliente: anon — categorías son públicas. Misma derivación que la tool
// list_categories (shared/stats.ts).
export function registerCategories(server: McpServer): void {
  server.registerResource(
    "categories",
    "mercadotech://categories",
    {
      title: "Categorías",
      description: "Categorías del catálogo con el número de productos activos de cada una.",
      mimeType: "application/json",
    },
    safeRead(async (uri) => {
      const { anon } = createContext();
      const categories = await getCategoriesWithCount(anon);
      return resourceJson(uri.href, categories);
    }),
  );
}
