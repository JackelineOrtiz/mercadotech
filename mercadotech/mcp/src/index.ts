// Entrada del servidor MCP de MercadoTech. Este import TIENE que ser el
// primero de todos — ver el comentario de ./lib/stderr-redirect.ts para el
// porqué exacto (orden de evaluación de imports en ESM).
import "./lib/stderr-redirect.js";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadEnv } from "./env.js";
import { createServer } from "./server.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";

async function main() {
  loadEnv();
  const server = createServer();
  registerTools(server);
  registerResources(server);
  registerPrompts(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[mercadotech-mcp] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
