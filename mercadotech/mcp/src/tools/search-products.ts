import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listActiveProducts } from "@/services/product.service";
import { createContext } from "../context.js";
import { safe } from "../lib/safe.js";
import { toolResult, toolError } from "../lib/tool-result.js";

// Cliente: anon — products activos son públicos, sin RLS que lo restrinja
// (products_select_active_or_own permite is_active a cualquiera).
export function registerSearchProducts(server: McpServer): void {
  server.registerTool(
    "search_products",
    {
      title: "Buscar productos",
      description:
        "Busca productos activos del catálogo por texto (título/marca) y filtros de categoría, " +
        "condición y precio. Coincidencia por palabra literal (no semántica) — para búsquedas " +
        "por significado ('audífonos para hacer ejercicio') usa semantic_search_products.",
      inputSchema: {
        search: z.string().optional().describe("Texto libre a buscar en título o marca."),
        categorySlug: z
          .string()
          .optional()
          .describe("Slug de una categoría (ver list_categories) para filtrar."),
        condition: z
          .array(z.enum(["nuevo", "usado", "reacondicionado"]))
          .optional()
          .describe("Condiciones físicas aceptadas."),
        minPrice: z.number().optional().describe("Precio mínimo en soles (S/)."),
        maxPrice: z.number().optional().describe("Precio máximo en soles (S/)."),
        sort: z
          .enum(["recientes", "precio_asc", "precio_desc"])
          .optional()
          .describe("Orden de los resultados. Por defecto: más recientes."),
        page: z.number().int().min(1).optional().describe("Página de resultados (12 por página)."),
      },
    },
    safe(async (input) => {
      const { anon } = createContext();
      const result = await listActiveProducts(
        {
          search: input.search,
          categorySlug: input.categorySlug,
          condition: input.condition,
          minPrice: input.minPrice,
          maxPrice: input.maxPrice,
          sort: input.sort,
          page: input.page,
        },
        anon,
      );
      return toolResult(result);
    }, toolError),
  );
}
