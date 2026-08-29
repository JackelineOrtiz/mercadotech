import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createContext } from "../context.js";
import { resourceJson, safeRead } from "../lib/resource-result.js";
import { getStoreStats } from "../shared/stats.js";

// Cliente: anon + admin — misma composición que la tool get_store_stats
// (shared/stats.ts), sin datos personales.
export function registerStats(server: McpServer): void {
  server.registerResource(
    "stats",
    "mercadotech://stats",
    {
      title: "Estadísticas de la tienda",
      description: "Productos activos, conteo por categoría y los más vendidos.",
      mimeType: "application/json",
    },
    safeRead(async (uri) => {
      const { anon, admin } = createContext();
      const stats = await getStoreStats(anon, admin);
      return resourceJson(uri.href, stats);
    }),
  );
}
