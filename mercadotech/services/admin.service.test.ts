import { describe, it, expect } from "vitest";
import { getPlatformStats, listUsers } from "@/services/admin.service";
import { mockSupabase } from "@/services/test-utils/supabase-mock";

describe("admin.service.getPlatformStats", () => {
  it("agrega usuarios por rol, pedidos por estado, e ingresos EXCLUYENDO cancelados", async () => {
    const supabase = mockSupabase({
      profiles: { select: [{ role: "buyer" }, { role: "buyer" }, { role: "seller" }] },
      orders: {
        select: [
          { status: "pagado", total: "100.00" },
          { status: "pagado", total: "50.00" },
          { status: "cancelado", total: "30.00" },
        ],
      },
      products: { count: 7 },
    });

    const stats = await getPlatformStats(supabase);

    expect(stats.totalUsers).toBe(3);
    expect(stats.usersByRole).toEqual({ buyer: 2, seller: 1, admin: 0 });
    expect(stats.totalOrders).toBe(3);
    expect(stats.ordersByStatus).toEqual({
      pendiente: 0,
      pagado: 2,
      enviado: 0,
      entregado: 0,
      cancelado: 1,
    });
    // 100 + 50, sin el pedido cancelado — un pedido cancelado no generó
    // ingreso real, aunque siga contando en ordersByStatus.
    expect(stats.totalRevenue).toBe(150);
    expect(stats.activeProducts).toBe(7);
  });

  it("sin datos: todo en cero, no NaN ni undefined", async () => {
    const supabase = mockSupabase({
      profiles: { select: [] },
      orders: { select: [] },
      products: { count: 0 },
    });

    const stats = await getPlatformStats(supabase);

    expect(stats.totalUsers).toBe(0);
    expect(stats.totalOrders).toBe(0);
    expect(stats.totalRevenue).toBe(0);
    expect(stats.activeProducts).toBe(0);
  });

  it("propaga el error de profiles tal cual, sin llegar a consultar orders/products", async () => {
    const supabase = mockSupabase({
      profiles: { error: { message: "permission denied" } },
    });
    await expect(getPlatformStats(supabase)).rejects.toMatchObject({
      message: "permission denied",
    });
  });
});

describe("admin.service.listUsers", () => {
  it("ordena por created_at desc y castea role, sin resolver avatar_url", async () => {
    const supabase = mockSupabase({
      profiles: {
        select: [
          { id: "u1", display_name: "Ana", phone: null, role: "buyer", created_at: "2026-01-01" },
        ],
      },
    });

    const users = await listUsers(supabase);

    expect(users).toEqual([
      {
        id: "u1",
        display_name: "Ana",
        phone: null,
        role: "buyer",
        created_at: "2026-01-01",
        avatar_url: null,
      },
    ]);
    const call = supabase.calls.find((c) => c.table === "profiles" && c.op === "select");
    expect(call?.chain).toContainEqual({
      method: "order",
      args: ["created_at", { ascending: false }],
    });
  });

  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase({ profiles: { error: { message: "network error" } } });
    await expect(listUsers(supabase)).rejects.toMatchObject({ message: "network error" });
  });
});
