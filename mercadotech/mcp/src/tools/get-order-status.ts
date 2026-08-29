import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getOrderById } from "@/services/order.service";
import { createContext } from "../context.js";
import { safe } from "../lib/safe.js";
import { toolResult, toolError } from "../lib/tool-result.js";
import { isPostgrestNotFoundError, NotFoundError } from "../lib/errors.js";

// Cliente: admin — orders/order_items exigen ser el comprador o vendedor
// del pedido (RLS); este servidor no tiene esa sesión que ofrecer.
// Devuelve SOLO estado/fecha/total/ítems snapshot — NUNCA buyer_id ni
// ningún otro dato del comprador (restricción explícita de la spec:
// "en producción exigiría auth del comprador"). Diseñada para que la
// reutilice el agente de voz de la Sesión 8 sin cambios.
export function registerGetOrderStatus(server: McpServer): void {
  server.registerTool(
    "get_order_status",
    {
      title: "Consultar el estado de un pedido",
      description:
        "Consulta el estado, fecha, total e ítems de un pedido por su id — para responder " +
        "'¿en qué va mi pedido?'. No expone ningún dato del comprador.",
      inputSchema: {
        orderId: z.string().describe("id (uuid) del pedido."),
      },
    },
    safe(async ({ orderId }) => {
      const { admin } = createContext();

      let order;
      try {
        order = await getOrderById(orderId, admin);
      } catch (err) {
        if (isPostgrestNotFoundError(err)) throw new NotFoundError(`pedido ${orderId}`);
        throw err;
      }

      // Lista blanca explícita (no "todo menos buyer_id"): si orders o
      // order_items ganan una columna nueva mañana, esta tool sigue sin
      // exponerla por defecto en vez de filtrarla sin querer.
      return toolResult({
        id: order.id,
        status: order.status,
        createdAt: order.created_at,
        total: order.total,
        items: order.items.map((item) => ({
          productId: item.product_id,
          titleSnapshot: item.title_snapshot,
          quantity: item.quantity,
          priceSnapshot: item.price_snapshot,
        })),
      });
    }, toolError),
  );
}
