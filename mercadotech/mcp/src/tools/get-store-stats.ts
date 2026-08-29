import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createContext } from "../context.js";
import { safe } from "../lib/safe.js";
import { toolResult, toolError } from "../lib/tool-result.js";
import { getStoreStats } from "../shared/stats.js";

// Cliente: anon + admin (decisión 4) — el total de productos activos y el
// conteo por categoría son públicos (anon); "top vendidos" lee order_items,
// que exige admin (RLS solo comprador/vendedor/admin del pedido). Cero
// datos personales: solo agregados (conteos, totales, unidades vendidas).
// Composición reutilizada por mercadotech://stats (Fase 5.4, misma forma).
export function registerGetStoreStats(server: McpServer): void {
  server.registerTool(
    "get_store_stats",
    {
      title: "Estadísticas de la tienda",
      description:
        "Estadísticas agregadas de MercadoTech: cuántos productos activos hay, cuántos por " +
        "categoría, y los más vendidos. Sin datos personales — solo conteos.",
      inputSchema: {},
    },
    safe(async () => {
      const { anon, admin } = createContext();
      const stats = await getStoreStats(anon, admin);
      return toolResult(stats);
    }, toolError),
  );
}
