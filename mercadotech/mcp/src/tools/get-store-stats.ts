import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listActiveProducts } from "@/services/product.service";
import { createContext } from "../context.js";
import { safe } from "../lib/safe.js";
import { toolResult, toolError } from "../lib/tool-result.js";
import { getCategoriesWithCount, getTopSellingProducts } from "../shared/stats.js";

const TOP_SELLING_LIMIT = 5;

// Cliente: anon + admin (decisión 4) — el total de productos activos y el
// conteo por categoría son públicos (anon); "top vendidos" lee order_items,
// que exige admin (RLS solo comprador/vendedor/admin del pedido). Cero
// datos personales: solo agregados (conteos, totales, unidades vendidas).
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

      const [{ total: totalActiveProducts }, categories, topSelling] = await Promise.all([
        listActiveProducts({}, anon),
        getCategoriesWithCount(anon),
        getTopSellingProducts(admin, TOP_SELLING_LIMIT),
      ]);

      return toolResult({ totalActiveProducts, categories, topSelling });
    }, toolError),
  );
}
