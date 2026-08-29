import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerInfo } from "./info.js";
import { registerProducts } from "./products.js";
import { registerProductDetail } from "./product-detail.js";
import { registerCategories } from "./categories.js";
import { registerSeller } from "./seller.js";
import { registerFaq } from "./faq.js";
import { registerStats } from "./stats.js";

// Registro central: agregar un resource = un archivo nuevo en
// mcp/src/resources/ + una línea acá.
export function registerResources(server: McpServer): void {
  registerInfo(server);
  registerProducts(server);
  registerProductDetail(server);
  registerCategories(server);
  registerSeller(server);
  registerFaq(server);
  registerStats(server);
}
