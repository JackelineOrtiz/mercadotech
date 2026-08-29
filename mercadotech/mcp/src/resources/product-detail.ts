import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createContext } from "../context.js";
import { resourceJson, safeRead, safeList } from "../lib/resource-result.js";
import { getProductDetail, getAllActiveProductsSummary } from "../shared/products.js";

// Cliente: anon — mismos datos públicos que la tool get_product, misma
// función compartida (shared/products.ts) — no se duplica la lógica.
export function registerProductDetail(server: McpServer): void {
  const template = new ResourceTemplate("mercadotech://products/{id}", {
    // list: enumera instancias REALES para que aparezcan en resources/list
    // (spec: "Los dos templates implementan además el callback list").
    list: safeList(async () => {
      const { anon } = createContext();
      const summaries = await getAllActiveProductsSummary(anon);
      return {
        resources: summaries.map((p) => ({
          uri: `mercadotech://products/${p.id}`,
          name: p.title,
          mimeType: "application/json",
        })),
      };
    }),
  });

  server.registerResource(
    "product-detail",
    template,
    {
      title: "Detalle de un producto",
      description: "Detalle completo de un producto por su id (misma forma que la tool get_product).",
      mimeType: "application/json",
    },
    safeRead(async (uri, variables) => {
      const id = String(variables.id);
      const { anon } = createContext();
      const detail = await getProductDetail(id, anon);
      return resourceJson(uri.href, detail);
    }),
  );
}
