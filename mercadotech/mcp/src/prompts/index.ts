import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDescribirProducto } from "./describir-producto.js";
import { registerCompararProductos } from "./comparar-productos.js";
import { registerRedactarRespuestaPregunta } from "./redactar-respuesta-pregunta.js";
import { registerResumenDeResenas } from "./resumen-de-resenas.js";
import { registerGenerarArticuloFaq } from "./generar-articulo-faq.js";

// Registro central: agregar un Prompt MCP = un archivo nuevo en
// mcp/src/prompts/ + una línea acá.
export function registerPrompts(server: McpServer): void {
  registerDescribirProducto(server);
  registerCompararProductos(server);
  registerRedactarRespuestaPregunta(server);
  registerResumenDeResenas(server);
  registerGenerarArticuloFaq(server);
}
