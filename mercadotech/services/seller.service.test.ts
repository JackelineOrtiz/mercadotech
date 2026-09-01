import { describe, it, expect } from "vitest";
import {
  listMyProducts,
  createProduct,
  updateProduct,
  toggleActive,
  deleteProduct,
  listMyOrders,
  updateOrderStatus,
  getSellerPublicProfile,
} from "@/services/seller.service";
import { mockSupabase } from "@/services/test-utils/supabase-mock";

const productRow = {
  id: "p1",
  seller_id: "s1",
  category_id: "c1",
  title: "Laptop",
  description: "desc",
  price: "999.00",
  stock: 3,
  condition: "nuevo",
  brand: "Acme",
  is_active: true,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  product_images: [],
  reviews: [],
};

describe("seller.service.listMyProducts", () => {
  it("filtra por seller_id, sin filtro de is_active (el vendedor ve sus inactivos también)", async () => {
    const supabase = mockSupabase({ products: { select: [productRow] } });
    const products = await listMyProducts("s1", supabase);
    expect(products).toHaveLength(1);
    const call = supabase.calls.find((c) => c.table === "products" && c.op === "select");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["seller_id", "s1"] });
    expect(call?.chain.some((c) => c.method === "eq" && c.args[0] === "is_active")).toBe(false);
  });
});

describe("seller.service.createProduct", () => {
  it("recorta espacios y convierte campos opcionales vacíos a null", async () => {
    const supabase = mockSupabase({ products: { single: { id: "new-id" } } });

    const id = await createProduct(
      "s1",
      {
        categoryId: "c1",
        title: "  Laptop  ",
        description: "   ",
        brand: "  ",
        condition: "nuevo",
        price: 100,
        stock: 5,
      },
      supabase,
    );

    expect(id).toBe("new-id");
    expect(supabase.inserts("products")).toContainEqual({
      seller_id: "s1",
      category_id: "c1",
      title: "Laptop",
      description: null,
      brand: null,
      condition: "nuevo",
      price: 100,
      stock: 5,
    });
  });
});

describe("seller.service.updateProduct / toggleActive", () => {
  it("updateProduct filtra por id", async () => {
    const supabase = mockSupabase({ products: {} });
    await updateProduct(
      "p1",
      { categoryId: "c1", title: "T", description: "d", brand: "b", condition: "usado", price: 1, stock: 1 },
      supabase,
    );
    const call = supabase.calls.find((c) => c.table === "products" && c.op === "update");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["id", "p1"] });
  });

  it("toggleActive actualiza solo is_active", async () => {
    const supabase = mockSupabase({ products: {} });
    await toggleActive("p1", false, supabase);
    expect(supabase.updates("products")).toContainEqual({ is_active: false });
  });
});

describe("seller.service.deleteProduct", () => {
  it("traduce el error 23503 (FK restrict por ventas) a un mensaje legible", async () => {
    const supabase = mockSupabase({
      products: { error: { code: "23503", message: "foreign key violation" } },
    });

    await expect(deleteProduct("p1", supabase)).rejects.toThrow(
      "Este producto tiene ventas; desactívalo en lugar de eliminarlo.",
    );
  });

  it("cualquier otro error se propaga tal cual, sin traducir", async () => {
    const supabase = mockSupabase({
      products: { error: { code: "42501", message: "permission denied" } },
    });

    await expect(deleteProduct("p1", supabase)).rejects.toMatchObject({
      message: "permission denied",
    });
  });
});

describe("seller.service.listMyOrders", () => {
  it("sin ítems propios: devuelve [] sin consultar orders", async () => {
    const supabase = mockSupabase({ order_items: { select: [] } });
    const orders = await listMyOrders("s1", supabase);
    expect(orders).toEqual([]);
    expect(supabase.calls.some((c) => c.table === "orders")).toBe(false);
  });

  it("pedido multi-vendedor: myItems/myTotal solo cuentan los ítems del vendedor consultado", async () => {
    // El propio query de order_items ya vino filtrado por seller_id (RLS +
    // .eq en el service) — el mock simula esa fila ya angosta a "mis
    // ítems", como en producción, no los ítems completos del pedido.
    const supabase = mockSupabase({
      order_items: {
        select: [
          { id: "i1", order_id: "o1", seller_id: "s1", product_id: "p1", quantity: 2, price_snapshot: "10.00" },
        ],
      },
      orders: {
        select: [
          { id: "o1", buyer_id: "u1", status: "pendiente", total: "50.00", created_at: "2026-01-01" },
        ],
      },
    });

    const orders = await listMyOrders("s1", supabase);

    expect(orders).toHaveLength(1);
    expect(orders[0].myItems).toHaveLength(1);
    expect(orders[0].myTotal).toBe(20);
    // total del pedido completo (de la tabla orders) sigue siendo 50, no 20:
    // es la suma real del pedido multi-vendedor, no solo la parte del vendedor.
    expect(orders[0].total).toBe(50);
  });

  it("propaga el error de order_items tal cual", async () => {
    const supabase = mockSupabase({
      order_items: { error: { message: "permission denied for table order_items" } },
    });
    await expect(listMyOrders("s1", supabase)).rejects.toMatchObject({
      message: "permission denied for table order_items",
    });
  });
});

describe("seller.service.updateOrderStatus", () => {
  it("actualiza status filtrando por id, sin validar la secuencia (eso lo hace el hook)", async () => {
    const supabase = mockSupabase({ orders: {} });
    await updateOrderStatus("o1", "enviado", supabase);
    expect(supabase.updates("orders")).toContainEqual({ status: "enviado" });
  });
});

describe("seller.service.getSellerPublicProfile", () => {
  it("lee de la vista public_profiles (no de profiles) y resuelve avatar_url", async () => {
    const supabase = mockSupabase({
      public_profiles: {
        maybeSingle: { id: "s1", display_name: "TecnoStore Perú", avatar_path: "s1/avatar.jpg" },
      },
    });

    const profile = await getSellerPublicProfile("s1", supabase);

    expect(profile).toEqual({
      id: "s1",
      display_name: "TecnoStore Perú",
      avatar_url: "https://fake.supabase.local/storage/v1/object/public/avatars/s1/avatar.jpg",
    });
    expect(supabase.calls.some((c) => c.table === "profiles")).toBe(false);
  });

  it("sin avatar_path: avatar_url null, sin llamar a getPublicUrl", async () => {
    const supabase = mockSupabase({
      public_profiles: { maybeSingle: { id: "s1", display_name: "TecnoStore Perú", avatar_path: null } },
    });
    const profile = await getSellerPublicProfile("s1", supabase);
    expect(profile?.avatar_url).toBeNull();
  });

  it("id inexistente o no es vendedor: null (maybeSingle sin filas)", async () => {
    const supabase = mockSupabase({ public_profiles: { maybeSingle: null } });
    const profile = await getSellerPublicProfile("no-existe", supabase);
    expect(profile).toBeNull();
  });

  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase({ public_profiles: { error: { message: "network error" } } });
    await expect(getSellerPublicProfile("s1", supabase)).rejects.toMatchObject({
      message: "network error",
    });
  });
});
