import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createContext } from "../context.js";
import { resourceJson, safeRead } from "../lib/resource-result.js";
import { getAllActiveProductsSummary } from "../shared/products.js";

// Cliente: anon — productos activos son públicos.
export function registerProducts(server: McpServer): void {
  server.registerResource(
    "products",
    "mercadotech://products",
    {
      title: "Catálogo de productos",
      description: "Resumen de todos los productos activos: id, título, precio y categoría.",
      mimeType: "application/json",
    },
    safeRead(async (uri) => {
      const { anon } = createContext();
      const summary = await getAllActiveProductsSummary(anon);
      return resourceJson(uri.href, summary);
    }),
  );
}
