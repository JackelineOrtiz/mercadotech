import { describe, it, expect } from "vitest";
import {
  listMyProducts,
  createProduct,
  updateProduct,
  toggleActive,
  deleteProduct,
  listMyOrders,
  getMyOrderDetail,
  updateOrderStatus,
  getSellerPublicProfile,
  listMyQuestions,
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

// Fase 7.5: detalle de UN pedido para el vendedor (antes las tarjetas del
// kanban no llevaban a ningún lado, ver components/seller/OrderKanbanCard).
// "No es mi pedido" y "no existe" dan el mismo resultado (null) — mismo
// criterio 404 que order.service.getOrderById para el comprador.
describe("seller.service.getMyOrderDetail", () => {
  it("sin ítems propios en ese pedido: devuelve null sin consultar orders", async () => {
    const supabase = mockSupabase({ order_items: { select: [] } });
    const order = await getMyOrderDetail("s1", "o1", supabase);
    expect(order).toBeNull();
    expect(supabase.calls.some((c) => c.table === "orders")).toBe(false);
  });

  it("con ítems propios: myItems/myTotal calculados, status/total del pedido mapeados", async () => {
    const supabase = mockSupabase({
      order_items: {
        select: [
          { id: "i1", order_id: "o1", seller_id: "s1", product_id: "p1", quantity: 2, price_snapshot: "10.00" },
        ],
      },
      orders: {
        maybeSingle: { id: "o1", buyer_id: "u1", status: "pagado", total: "50.00", created_at: "2026-01-01" },
      },
    });

    const order = await getMyOrderDetail("s1", "o1", supabase);

    expect(order).not.toBeNull();
    expect(order!.myItems).toHaveLength(1);
    expect(order!.myTotal).toBe(20);
    expect(order!.status).toBe("pagado");
    // total del pedido completo, no solo la parte del vendedor.
    expect(order!.total).toBe(50);
  });

  it("ítems propios pero el pedido ya no existe: devuelve null", async () => {
    const supabase = mockSupabase({
      order_items: {
        select: [
          { id: "i1", order_id: "o1", seller_id: "s1", product_id: "p1", quantity: 1, price_snapshot: "10.00" },
        ],
      },
      orders: { maybeSingle: null },
    });

    const order = await getMyOrderDetail("s1", "o1", supabase);
    expect(order).toBeNull();
  });

  it("propaga el error de order_items tal cual", async () => {
    const supabase = mockSupabase({
      order_items: { error: { message: "permission denied for table order_items" } },
    });
    await expect(getMyOrderDetail("s1", "o1", supabase)).rejects.toMatchObject({
      message: "permission denied for table order_items",
    });
  });

  it("propaga el error de orders tal cual", async () => {
    const supabase = mockSupabase({
      order_items: {
        select: [
          { id: "i1", order_id: "o1", seller_id: "s1", product_id: "p1", quantity: 1, price_snapshot: "10.00" },
        ],
      },
      orders: { error: { message: "permission denied for table orders" } },
    });
    await expect(getMyOrderDetail("s1", "o1", supabase)).rejects.toMatchObject({
      message: "permission denied for table orders",
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

// Fase 7.5: antes solo se podía responder entrando a la página pública de
// cada producto — sin ningún lugar en el panel que juntara las
// pendientes. questions_select_all es pública (using (true)), así que no
// hay nada de RLS que probar acá, solo el cruce con "mis productos".
// Hallazgo real #2 (mismo smoke test, después de que #1 ya estaba
// resuelto): esta función SOLO traía answer is null — responder una
// pregunta la hacía desaparecer sin dejar rastro de lo contestado. Ahora
// trae todas (pendientes y respondidas); la UI las separa.
describe("seller.service.listMyQuestions", () => {
  it("sin productos propios: devuelve [] sin consultar questions", async () => {
    const supabase = mockSupabase({ products: { select: [] } });
    const questions = await listMyQuestions("s1", supabase);
    expect(questions).toEqual([]);
    expect(supabase.calls.some((c) => c.table === "questions")).toBe(false);
  });

  it("resuelve productTitle por product_id y trae TODAS las preguntas, respondidas incluidas", async () => {
    const supabase = mockSupabase({
      products: {
        select: [
          { id: "p1", title: "Laptop" },
          { id: "p2", title: "Mouse" },
        ],
      },
      questions: {
        select: [
          {
            id: "q1",
            product_id: "p1",
            user_id: "u1",
            question: "¿Trae cargador?",
            answer: null,
            answered_at: null,
            created_at: "2026-01-02",
          },
          {
            id: "q2",
            product_id: "p2",
            user_id: "u2",
            question: "¿Es inalámbrico?",
            answer: "Sí, 2.4GHz.",
            answered_at: "2026-01-01T12:00:00.000Z",
            created_at: "2026-01-01",
          },
        ],
      },
    });

    const questions = await listMyQuestions("s1", supabase);

    expect(questions).toEqual([
      {
        id: "q1",
        product_id: "p1",
        user_id: "u1",
        question: "¿Trae cargador?",
        answer: null,
        answered_at: null,
        created_at: "2026-01-02",
        productTitle: "Laptop",
      },
      {
        id: "q2",
        product_id: "p2",
        user_id: "u2",
        question: "¿Es inalámbrico?",
        answer: "Sí, 2.4GHz.",
        answered_at: "2026-01-01T12:00:00.000Z",
        created_at: "2026-01-01",
        productTitle: "Mouse",
      },
    ]);
    const call = supabase.calls.find((c) => c.table === "questions" && c.op === "select");
    expect(call?.chain.some((c) => c.method === "is")).toBe(false);
  });

  it("propaga el error de leer los productos propios tal cual", async () => {
    const supabase = mockSupabase({
      products: { error: { message: "permission denied for table products" } },
    });
    await expect(listMyQuestions("s1", supabase)).rejects.toMatchObject({
      message: "permission denied for table products",
    });
  });

  it("propaga el error de leer las preguntas tal cual", async () => {
    const supabase = mockSupabase({
      products: { select: [{ id: "p1", title: "Laptop" }] },
      questions: { error: { message: "permission denied for table questions" } },
    });
    await expect(listMyQuestions("s1", supabase)).rejects.toMatchObject({
      message: "permission denied for table questions",
    });
  });
});

describe("seller.service.getSellerPublicProfile", () => {
  it("lee de la vista public_profiles (no de profiles) y resuelve avatar_url", async () => {
    const supabase = mockSupabase({
      public_profiles: {
        maybeSingle: { id: "s1", display_name: "TecnoStore Colombia", avatar_path: "s1/avatar.jpg" },
      },
    });

    const profile = await getSellerPublicProfile("s1", supabase);

    expect(profile).toEqual({
      id: "s1",
      display_name: "TecnoStore Colombia",
      avatar_url: "https://fake.supabase.local/storage/v1/object/public/avatars/s1/avatar.jpg",
    });
    expect(supabase.calls.some((c) => c.table === "profiles")).toBe(false);
  });

  it("sin avatar_path: avatar_url null, sin llamar a getPublicUrl", async () => {
    const supabase = mockSupabase({
      public_profiles: { maybeSingle: { id: "s1", display_name: "TecnoStore Colombia", avatar_path: null } },
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
