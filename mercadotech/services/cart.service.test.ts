import { describe, it, expect, vi } from "vitest";
import { getItems, addItem, updateQuantity, removeItem, clear } from "@/services/cart.service";
import { mockSupabase } from "@/services/test-utils/supabase-mock";

describe("cart.service.getItems", () => {
  it("comportamiento actual, revisar: mapCartItem NO pasa el cliente inyectado a getPublicUrl (a diferencia de mapProduct en product.service.ts, que sí lo hace explícito) — resolver la portada de un ítem del carrito SIEMPRE construye un cliente de navegador nuevo por defecto en vez de usar el que recibió getItems. Confirmado empíricamente: incluso stubeando NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, createClient() explota en Node puro con el mismo error que product.service.ts documenta haber corregido en la Fase 4.7 (\"Node.js detected but native WebSocket not found\") — getItems solo funciona hoy porque nunca se llama fuera del navegador (el hook del carrito), pero si algún día se llama desde un Route Handler o script con el cliente admin, se cae exactamente así.", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fake.supabase.local");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fake-anon-key");

    const supabase = mockSupabase({
      cart_items: {
        select: [
          {
            id: "c1",
            product_id: "p1",
            quantity: 2,
            products: {
              id: "p1",
              title: "Laptop",
              price: 999.9,
              stock: 4,
              product_images: [{ image_path: "s1/p1/0.jpg", position: 0 }],
            },
          },
        ],
      },
    });

    await expect(getItems("u1", supabase)).rejects.toThrow(/WebSocket/);

    vi.unstubAllEnvs();
  });

  it("producto null (borrado/desactivado): product queda null en vez de romper", async () => {
    const supabase = mockSupabase({
      cart_items: { select: [{ id: "c1", product_id: "p1", quantity: 2, products: null }] },
    });
    const items = await getItems("u1", supabase);
    expect(items[0].product).toBeNull();
  });

  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase({ cart_items: { error: { message: "permission denied" } } });
    await expect(getItems("u1", supabase)).rejects.toMatchObject({ message: "permission denied" });
  });

  // Fase 7.5, hallazgo real en producción: una fila insertada ANTES de
  // que existiera el tope de MAX_CART_QUANTITY (10) queda con una
  // cantidad vieja mucho más alta — getItems ahora la recorta Y la
  // persiste, no solo la devuelve recortada para esta respuesta.
  it("fila vieja con quantity por encima de min(stock, MAX_CART_QUANTITY): la recorta Y la persiste", async () => {
    const supabase = mockSupabase({
      cart_items: {
        select: [
          {
            id: "c1",
            product_id: "p1",
            quantity: 10000,
            products: {
              id: "p1",
              title: "insta 360",
              price: 555555555,
              stock: 10000,
              product_images: [],
            },
          },
        ],
      },
    });

    const items = await getItems("u1", supabase);

    expect(items[0].quantity).toBe(10);
    expect(supabase.updates("cart_items")).toContainEqual({ quantity: 10 });
  });

  it("fila vieja por encima del stock (no de MAX_CART_QUANTITY): recorta al stock real", async () => {
    const supabase = mockSupabase({
      cart_items: {
        select: [
          {
            id: "c1",
            product_id: "p1",
            quantity: 8,
            products: { id: "p1", title: "Mouse", price: 100, stock: 3, product_images: [] },
          },
        ],
      },
    });

    const items = await getItems("u1", supabase);

    expect(items[0].quantity).toBe(3);
    expect(supabase.updates("cart_items")).toContainEqual({ quantity: 3 });
  });

  it("cantidad ya dentro de los dos topes: no dispara ningún UPDATE", async () => {
    const supabase = mockSupabase({
      cart_items: {
        select: [
          {
            id: "c1",
            product_id: "p1",
            quantity: 2,
            products: { id: "p1", title: "Mouse", price: 100, stock: 5, product_images: [] },
          },
        ],
      },
    });

    const items = await getItems("u1", supabase);

    expect(items[0].quantity).toBe(2);
    expect(supabase.updates("cart_items")).toEqual([]);
  });

  it("producto null (borrado/desactivado): no intenta corregir nada, no revienta", async () => {
    const supabase = mockSupabase({
      cart_items: { select: [{ id: "c1", product_id: "p1", quantity: 10000, products: null }] },
    });

    const items = await getItems("u1", supabase);

    expect(items[0].quantity).toBe(10000);
    expect(supabase.updates("cart_items")).toEqual([]);
  });
});

// Cliente Supabase SIEMPRE inyectado (decisión 7) — nunca vi.mock de
// lib/supabase/*. Ancla al comportamiento REAL (decisión 5 de la spec):
// addItem SUMA el duplicado y recorta a [1, stock], nunca "rechaza".

describe("cart.service.addItem", () => {
  it("producto nuevo (sin fila previa en el carrito): inserta", async () => {
    const supabase = mockSupabase({
      products: { single: { stock: 10 } },
      cart_items: { maybeSingle: null },
    });

    const result = await addItem("u1", "p1", 3, supabase);

    expect(supabase.inserts("cart_items")).toContainEqual({
      user_id: "u1",
      product_id: "p1",
      quantity: 3,
    });
    expect(result).toEqual({ added: 3, capped: false });
  });

  it("duplicado: SUMA la cantidad existente y recorta al stock, reportando cuánto se agregó de verdad", async () => {
    const supabase = mockSupabase({
      cart_items: { maybeSingle: { id: "c1", quantity: 3 } },
      products: { single: { stock: 4 } },
    });

    const result = await addItem("u1", "p1", 5, supabase);

    // 3 + 5 = 8, tope = stock (4) → solo se agregó 1 de verdad
    expect(supabase.updates("cart_items")).toContainEqual({ quantity: 4 });
    expect(result).toEqual({ added: 1, capped: true });
  });

  it("duplicado ya en el tope del stock: added=0, no rechaza (decisión 5) pero lo reporta", async () => {
    const supabase = mockSupabase({
      cart_items: { maybeSingle: { id: "c1", quantity: 4 } },
      products: { single: { stock: 4 } },
    });

    const result = await addItem("u1", "p1", 1, supabase);

    expect(supabase.updates("cart_items")).toContainEqual({ quantity: 4 });
    expect(result).toEqual({ added: 0, capped: true });
  });

  it("producto nuevo con cantidad pedida por encima del stock: recorta al insertar", async () => {
    const supabase = mockSupabase({
      products: { single: { stock: 2 } },
      cart_items: { maybeSingle: null },
    });

    const result = await addItem("u1", "p1", 10, supabase);

    expect(supabase.inserts("cart_items")).toContainEqual({
      user_id: "u1",
      product_id: "p1",
      quantity: 2,
    });
    expect(result).toEqual({ added: 2, capped: true });
  });

  it("stock enorme: recorta a MAX_CART_QUANTITY (10), no al stock real (Fase 7.5, hallazgo real: numeric field overflow en el checkout con stock=10000 y 1553 unidades pedidas)", async () => {
    const supabase = mockSupabase({
      products: { single: { stock: 10000 } },
      cart_items: { maybeSingle: null },
    });

    const result = await addItem("u1", "p1", 1553, supabase);

    expect(supabase.inserts("cart_items")).toContainEqual({
      user_id: "u1",
      product_id: "p1",
      quantity: 10,
    });
    expect(result).toEqual({ added: 10, capped: true });
  });

  it("propaga el error de leer el stock del producto tal cual", async () => {
    const supabase = mockSupabase({
      products: { error: { message: "producto no encontrado", code: "PGRST116" } },
    });

    await expect(addItem("u1", "p1", 1, supabase)).rejects.toMatchObject({
      message: "producto no encontrado",
    });
  });

  it("propaga el error de leer el carrito existente tal cual", async () => {
    const supabase = mockSupabase({
      products: { single: { stock: 5 } },
      cart_items: { error: { message: "permission denied for table cart_items" } },
    });

    await expect(addItem("u1", "p1", 1, supabase)).rejects.toMatchObject({
      message: "permission denied for table cart_items",
    });
  });
});

describe("cart.service.updateQuantity", () => {
  it("clampea al stock actual (hallazgo de la Fase 5.6, ya corregido)", async () => {
    const supabase = mockSupabase({
      cart_items: { single: { product_id: "p1" } },
      products: { single: { stock: 3 } },
    });

    await updateQuantity("c1", 10, supabase);

    expect(supabase.updates("cart_items")).toContainEqual({ quantity: 3 });
  });

  it("clampea a MAX_CART_QUANTITY aunque el stock real sea mucho mayor (Fase 7.5)", async () => {
    const supabase = mockSupabase({
      cart_items: { single: { product_id: "p1" } },
      products: { single: { stock: 10000 } },
    });

    await updateQuantity("c1", 1553, supabase);

    expect(supabase.updates("cart_items")).toContainEqual({ quantity: 10 });
  });

  it("una cantidad dentro del stock no se recorta", async () => {
    const supabase = mockSupabase({
      cart_items: { single: { product_id: "p1" } },
      products: { single: { stock: 3 } },
    });

    await updateQuantity("c1", 2, supabase);

    expect(supabase.updates("cart_items")).toContainEqual({ quantity: 2 });
  });

  it("propaga el error tal cual (el mock aplica `error` a toda la tabla, incluye el SELECT previo)", async () => {
    // Nota de diseño: supabase-mock.ts resuelve `error` a nivel de TABLA
    // completa, no por operación individual — no distingue "el SELECT
    // encontró la fila pero el UPDATE final falló" de "la tabla entera
    // falla". Para este service el resultado observable es el mismo
    // (updateQuantity nunca llega a resolver la promesa con éxito), así
    // que basta con verificar que el error se propague tal cual.
    const supabase = mockSupabase({
      cart_items: { error: { message: "stock desactualizado" } },
      products: { single: { stock: 3 } },
    });

    await expect(updateQuantity("c1", 2, supabase)).rejects.toMatchObject({
      message: "stock desactualizado",
    });
  });
});

describe("cart.service.removeItem", () => {
  it("borra filtrando por id", async () => {
    const supabase = mockSupabase({ cart_items: {} });
    await removeItem("c1", supabase);
    const call = supabase.calls.find((c) => c.table === "cart_items" && c.op === "delete");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["id", "c1"] });
  });

  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase({ cart_items: { error: { message: "no encontrado" } } });
    await expect(removeItem("c1", supabase)).rejects.toMatchObject({ message: "no encontrado" });
  });
});

describe("cart.service.clear", () => {
  it("borra todo el carrito de un usuario filtrando por user_id", async () => {
    const supabase = mockSupabase({ cart_items: {} });
    await clear("u1", supabase);
    const call = supabase.calls.find((c) => c.table === "cart_items" && c.op === "delete");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["user_id", "u1"] });
  });

  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase({ cart_items: { error: { message: "permission denied" } } });
    await expect(clear("u1", supabase)).rejects.toMatchObject({ message: "permission denied" });
  });
});
