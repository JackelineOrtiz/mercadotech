import { describe, it, expect } from "vitest";
import { listByProduct, getAverage, canReview, create, reply } from "@/services/review.service";
import { mockSupabase } from "@/services/test-utils/supabase-mock";

describe("review.service.listByProduct", () => {
  it("filtra por product_id y ordena por created_at desc", async () => {
    const supabase = mockSupabase({ reviews: { select: [] } });
    await listByProduct("p1", supabase);
    const call = supabase.calls.find((c) => c.table === "reviews" && c.op === "select");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["product_id", "p1"] });
    expect(call?.chain).toContainEqual({ method: "order", args: ["created_at", { ascending: false }] });
  });
});

describe("review.service.getAverage", () => {
  it("sin reviews: average null, count 0 (no división por cero)", async () => {
    const supabase = mockSupabase({ reviews: { select: [] } });
    const result = await getAverage("p1", supabase);
    expect(result).toEqual({ average: null, count: 0 });
  });

  it("promedia los ratings reales", async () => {
    const supabase = mockSupabase({ reviews: { select: [{ rating: 5 }, { rating: 3 }] } });
    const result = await getAverage("p1", supabase);
    expect(result).toEqual({ average: 4, count: 2 });
  });
});

describe("review.service.canReview", () => {
  it("ya tiene reseña propia: allowed=false, sin siquiera consultar orders", async () => {
    const supabase = mockSupabase({
      reviews: { maybeSingle: { id: "r1" } },
    });
    const result = await canReview("p1", "u1", supabase);
    expect(result).toEqual({ allowed: false, orderId: null });
    expect(supabase.calls.some((c) => c.table === "orders")).toBe(false);
  });

  it("sin reseña previa y con un pedido entregado que contiene el producto: allowed=true", async () => {
    const supabase = mockSupabase({
      reviews: { maybeSingle: null },
      orders: {
        select: [{ id: "o1", order_items: [{ product_id: "p1" }, { product_id: "p2" }] }],
      },
    });
    const result = await canReview("p1", "u1", supabase);
    expect(result).toEqual({ allowed: true, orderId: "o1" });
  });

  it("sin reseña previa pero ningún pedido entregado trae el producto: allowed=false", async () => {
    const supabase = mockSupabase({
      reviews: { maybeSingle: null },
      orders: { select: [{ id: "o1", order_items: [{ product_id: "otro-producto" }] }] },
    });
    const result = await canReview("p1", "u1", supabase);
    expect(result).toEqual({ allowed: false, orderId: null });
  });

  it("filtra orders por buyer_id y status='entregado'", async () => {
    const supabase = mockSupabase({
      reviews: { maybeSingle: null },
      orders: { select: [] },
    });
    await canReview("p1", "u1", supabase);
    const call = supabase.calls.find((c) => c.table === "orders" && c.op === "select");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["buyer_id", "u1"] });
    expect(call?.chain).toContainEqual({ method: "eq", args: ["status", "entregado"] });
  });
});

describe("review.service.create", () => {
  it("inserta con los 5 campos esperados y devuelve la fila creada", async () => {
    const created = { id: "r1", product_id: "p1", buyer_id: "u1", order_id: "o1", rating: 5, comment: "Excelente" };
    const supabase = mockSupabase({ reviews: { single: created } });

    const review = await create(
      { productId: "p1", buyerId: "u1", orderId: "o1", rating: 5, comment: "Excelente" },
      supabase,
    );

    expect(review).toEqual(created);
    expect(supabase.inserts("reviews")).toContainEqual({
      product_id: "p1",
      buyer_id: "u1",
      order_id: "o1",
      rating: 5,
      comment: "Excelente",
    });
  });

  it("propaga el error tal cual (ej. unique product_id+buyer_id violado)", async () => {
    const supabase = mockSupabase({
      reviews: { error: { message: "duplicate key value violates unique constraint" } },
    });
    await expect(
      create({ productId: "p1", buyerId: "u1", orderId: "o1", rating: 5 }, supabase),
    ).rejects.toMatchObject({ message: "duplicate key value violates unique constraint" });
  });
});

// Fase 7.5: permitido por reviews_update_seller_reply (RLS) +
// protect_review_columns_trigger, que es quien de verdad restringe que
// este UPDATE solo pueda tocar seller_reply/seller_reply_at — este test
// solo ancla el UPDATE que arma el service, no la protección en sí (eso
// vive en la base, no se puede probar con este mock).
describe("review.service.reply", () => {
  it("actualiza seller_reply y seller_reply_at, filtrando por id", async () => {
    const updated = {
      id: "r1",
      product_id: "p1",
      buyer_id: "u1",
      order_id: "o1",
      rating: 5,
      comment: "Excelente",
      seller_reply: "¡Gracias por tu compra!",
      seller_reply_at: "2026-01-01T00:00:00.000Z",
    };
    const supabase = mockSupabase({ reviews: { single: updated } });

    const review = await reply("r1", "¡Gracias por tu compra!", supabase);

    expect(review).toEqual(updated);
    const call = supabase.calls.find((c) => c.table === "reviews" && c.op === "update");
    expect(call?.payload).toMatchObject({ seller_reply: "¡Gracias por tu compra!" });
    expect(call?.chain).toContainEqual({ method: "eq", args: ["id", "r1"] });
  });

  it("propaga el error tal cual (ej. el trigger rechaza porque no sos el vendedor)", async () => {
    const supabase = mockSupabase({
      reviews: { error: { message: "El vendedor solo puede editar su respuesta a la reseña" } },
    });
    await expect(reply("r1", "texto", supabase)).rejects.toMatchObject({
      message: "El vendedor solo puede editar su respuesta a la reseña",
    });
  });
});
