import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resourceJson, safeRead } from "../lib/resource-result.js";

// Estático — no toca la BD. Describe la plataforma y lo que ofrece este
// servidor para un cliente MCP que la ve por primera vez.
export function registerInfo(server: McpServer): void {
  server.registerResource(
    "info",
    "mercadotech://info",
    {
      title: "Información de MercadoTech",
      description: "Descripción de la plataforma y de las capacidades de este servidor MCP.",
      mimeType: "application/json",
    },
    safeRead(async (uri) => {
      return resourceJson(uri.href, {
        name: "MercadoTech",
        description:
          "Marketplace de productos tecnológicos en Colombia, con búsqueda semántica y asistentes " +
          "de compras/soporte basados en el catálogo y la FAQ reales de la plataforma.",
        readOnly: true,
        tools: [
          "search_products",
          "get_product",
          "list_categories",
          "semantic_search_products",
          "ask_assistant",
          "compare_products",
          "find_related_products",
          "summarize_reviews",
          "get_store_stats",
          "get_order_status",
        ],
        resources: [
          "mercadotech://info",
          "mercadotech://products",
          "mercadotech://products/{id}",
          "mercadotech://categories",
          "mercadotech://sellers/{sellerId}",
          "mercadotech://faq",
          "mercadotech://stats",
        ],
        prompts: [
          "describir_producto",
          "comparar_productos",
          "redactar_respuesta_pregunta",
          "resumen_de_resenas",
          "generar_articulo_faq",
        ],
      });
    }),
  );
}
