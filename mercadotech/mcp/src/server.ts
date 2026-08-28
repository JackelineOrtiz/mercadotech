import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Metadata + capabilities del servidor. Esta fase (5.2) arranca VACÍO a
// propósito: cero tools/resources/prompts registrados — eso llega en las
// Fases 5.3 y 5.4, que importarán esta factory y llamarán a
// `server.registerTool(...)`/`registerResource(...)`/`registerPrompt(...)`
// sobre la instancia antes de conectarla al transporte en index.ts.
export function createServer(): McpServer {
  return new McpServer(
    { name: "mercadotech", version: "0.1.0" },
    { capabilities: {} },
  );
}
