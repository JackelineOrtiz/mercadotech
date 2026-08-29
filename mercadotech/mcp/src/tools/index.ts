import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSearchProducts } from "./search-products.js";
import { registerGetProduct } from "./get-product.js";
import { registerListCategories } from "./list-categories.js";
import { registerSemanticSearchProducts } from "./semantic-search-products.js";
import { registerAskAssistant } from "./ask-assistant.js";
import { registerCompareProducts } from "./compare-products.js";
import { registerFindRelatedProducts } from "./find-related-products.js";
import { registerSummarizeReviews } from "./summarize-reviews.js";
import { registerGetStoreStats } from "./get-store-stats.js";
import { registerGetOrderStatus } from "./get-order-status.js";

// Registro central: agregar una tool = un archivo nuevo en mcp/src/tools/
// + una línea acá.
export function registerTools(server: McpServer): void {
  registerSearchProducts(server);
  registerGetProduct(server);
  registerListCategories(server);
  registerSemanticSearchProducts(server);
  registerAskAssistant(server);
  registerCompareProducts(server);
  registerFindRelatedProducts(server);
  registerSummarizeReviews(server);
  registerGetStoreStats(server);
  registerGetOrderStatus(server);
}
