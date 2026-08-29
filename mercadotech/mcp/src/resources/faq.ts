import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listPublished } from "@/services/support-article.service";
import { createContext } from "../context.js";
import { resourceJson, safeRead } from "../lib/resource-result.js";

// Cliente: anon — support_articles publicados son públicos
// (support_articles_select_published, Fase 2.3).
export function registerFaq(server: McpServer): void {
  server.registerResource(
    "faq",
    "mercadotech://faq",
    {
      title: "Artículos de ayuda (FAQ)",
      description: "Todos los artículos de soporte publicados, con su categoría y contenido.",
      mimeType: "application/json",
    },
    safeRead(async (uri) => {
      const { anon } = createContext();
      const articles = await listPublished(anon);
      return resourceJson(uri.href, articles);
    }),
  );
}
