import { describe, it, expect } from "vitest";
import { checkout, listMyOrders, getOrderById, cancelIfPending } from "@/services/order.service";
import { mockSupabase } from "@/services/test-utils/supabase-mock";

// Ancla: checkout es el ÚNICO camino para crear un pedido (orders/order_items
// no tienen política de INSERT) — pasa por la RPC create_order_from_cart y
// propaga el error de Postgres TAL CUAL (sin envolver ni traducir mensaje).

describe("order.service.checkout", () => {
  it("llama a la RPC create_order_from_cart con p_buyer_id y devuelve el id creado", async () => {
    const supabase = mockSupabase(
      {},
      { rpc: { create_order_from_cart: { data: "order-123", error: null } } },
    );

    const orderId = await checkout("u1", supabase);

    expect(orderId).toBe("order-123");
    expect(supabase.rpcCalls).toContainEqual({
      name: "create_order_from_cart",
      args: { p_buyer_id: "u1" },
    });
  });

  it("propaga el error de Postgres de la RPC tal cual (ej. stock insuficiente)", async () => {
    const supabase = mockSupabase(
      {},
      {
        rpc: {
          create_order_from_cart: {
            error: { message: "stock insuficiente para el producto p1" },
          },
        },
      },
    );

    await expect(checkout("u1", supabase)).rejects.toMatchObject({
      message: "stock insuficiente para el producto p1",
    });
  });
});

describe("order.service.listMyOrders", () => {
  it("mapea total (numeric → string en Postgres) a number", async () => {
    const supabase = mockSupabase({
      orders: {
        select: [
          { id: "o1", buyer_id: "u1", status: "pendiente", total: "199.90", created_at: "2026-01-01" },
        ],
      },
    });

    const orders = await listMyOrders("u1", supabase);

    expect(orders).toEqual([
      { id: "o1", buyer_id: "u1", status: "pendiente", total: 199.9, created_at: "2026-01-01" },
    ]);
    expect(typeof orders[0].total).toBe("number");
  });

  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase({
      orders: { error: { message: "permission denied for table orders" } },
    });

    await expect(listMyOrders("u1", supabase)).rejects.toMatchObject({
      message: "permission denied for table orders",
    });
  });
});

describe("order.service.getOrderById", () => {
  it("combina el pedido con sus items y convierte price_snapshot a number", async () => {
    const supabase = mockSupabase({
      orders: {
        single: { id: "o1", buyer_id: "u1", status: "pagado", total: "50.00", created_at: "2026-01-01" },
      },
      order_items: {
        select: [
          { id: "i1", order_id: "o1", product_id: "p1", quantity: 2, price_snapshot: "25.00" },
        ],
      },
    });

    const order = await getOrderById("o1", supabase);

    expect(order.total).toBe(50);
    expect(order.items).toEqual([
      { id: "i1", order_id: "o1", product_id: "p1", quantity: 2, price_snapshot: 25 },
    ]);
  });

  it("propaga el error de leer el pedido tal cual, sin siquiera intentar los items", async () => {
    const supabase = mockSupabase({
      orders: { error: { message: "no encontrado", code: "PGRST116" } },
    });

    await expect(getOrderById("o1", supabase)).rejects.toMatchObject({ message: "no encontrado" });
  });
});

describe("order.service.cancelIfPending", () => {
  it("actualiza a 'cancelado' filtrando por id y status='pendiente'", async () => {
    const supabase = mockSupabase({ orders: {} });

    await cancelIfPending("o1", supabase);

    expect(supabase.updates("orders")).toContainEqual({ status: "cancelado" });
    const call = supabase.calls.find((c) => c.table === "orders" && c.op === "update");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["id", "o1"] });
    expect(call?.chain).toContainEqual({ method: "eq", args: ["status", "pendiente"] });
  });

  it("propaga el error tal cual (ej. si RLS ya lo rechazó porque cambió de estado)", async () => {
    const supabase = mockSupabase({
      orders: { error: { message: "new row violates row-level security policy" } },
    });

    await expect(cancelIfPending("o1", supabase)).rejects.toMatchObject({
      message: "new row violates row-level security policy",
    });
  });
});
