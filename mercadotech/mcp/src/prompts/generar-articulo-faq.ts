import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listPublished } from "@/services/support-article.service";
import { createContext } from "../context.js";
import { instructionMessage, embeddedResourceMessage } from "../lib/prompt-result.js";

const STYLE_REFERENCE_LIMIT = 3;

export function registerGenerarArticuloFaq(server: McpServer): void {
  server.registerPrompt(
    "generar_articulo_faq",
    {
      title: "Generar artículo de FAQ",
      description:
        "Borrador de un artículo de soporte NUEVO sobre un tema dado, con el mismo estilo (título " +
        "pregunta, tono directo) que los artículos publicados reales.",
      argsSchema: { tema: z.string().min(1).describe("Tema del artículo nuevo, en pocas palabras.") },
    },
    async ({ tema }) => {
      const { anon } = createContext();
      const published = await listPublished(anon);
      const styleReference = published.slice(0, STYLE_REFERENCE_LIMIT);

      return {
        description: `Borrador de FAQ: ${tema}`,
        messages: [
          instructionMessage(
            `Redacta el BORRADOR de un artículo de soporte nuevo sobre "${tema}" para ` +
              "MercadoTech, en español. Usa los artículos publicados de abajo SOLO como " +
              "referencia de estilo (título como pregunta, 2-4 oraciones, tono directo y " +
              "cordial) — no copies su contenido. Regla estricta: es un BORRADOR para revisión " +
              "humana, no publiques políticas, plazos ni montos específicos que no te hayan " +
              "dado — si el tema los requiere, escribe un placeholder claro como " +
              "'[confirmar plazo exacto]' en vez de inventar un número. Termina con una línea " +
              "aparte: 'Categoría sugerida: <categoría>', tomando como referencia las " +
              "categorías reales que ya existen abajo.",
          ),
          embeddedResourceMessage("mercadotech://faq", styleReference),
        ],
      };
    },
  );
}
