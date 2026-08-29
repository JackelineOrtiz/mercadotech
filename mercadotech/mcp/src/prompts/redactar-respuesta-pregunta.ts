import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getById } from "@/services/question.service";
import { getProductById } from "@/services/product.service";
import { createContext } from "../context.js";
import { isPostgrestNotFoundError } from "../lib/errors.js";
import { instructionMessage, embeddedResourceMessage } from "../lib/prompt-result.js";

export function registerRedactarRespuestaPregunta(server: McpServer): void {
  server.registerPrompt(
    "redactar_respuesta_pregunta",
    {
      title: "Redactar respuesta a una pregunta",
      description:
        "Borrador de respuesta para el vendedor a una pregunta pública de un producto, con el " +
        "contexto real del producto.",
      argsSchema: { questionId: z.string().describe("id (uuid) de la pregunta.") },
    },
    async ({ questionId }) => {
      const { anon } = createContext();

      let question;
      try {
        question = await getById(questionId, anon);
      } catch (err) {
        if (!isPostgrestNotFoundError(err)) throw err;
        return {
          messages: [instructionMessage(`No se encontró la pregunta ${questionId}.`)],
        };
      }

      if (question.answer) {
        return {
          messages: [
            instructionMessage(
              `La pregunta ${questionId} ya tiene respuesta: "${question.answer}". No hace falta ` +
                "redactar una nueva.",
            ),
          ],
        };
      }

      const product = await getProductById(question.product_id, anon);

      return {
        description: `Respuesta a: ${question.question}`,
        messages: [
          instructionMessage(
            "Redacta, en español, un borrador de respuesta del VENDEDOR a la pregunta pública " +
              "de abajo, usando el producto embebido como contexto. Reglas estrictas: responde " +
              "SOLO con datos reales del producto (nunca inventes especificaciones, garantía ni " +
              "plazos que no estén ahí); si la pregunta no se puede responder con los datos " +
              "disponibles, el borrador debe decirlo con honestidad en vez de inventar; 2-3 " +
              "oraciones, tono directo y cordial.",
          ),
          instructionMessage(`Pregunta del comprador: "${question.question}"`),
          embeddedResourceMessage(`mercadotech://products/${product.id}`, product),
        ],
      };
    },
  );
}
