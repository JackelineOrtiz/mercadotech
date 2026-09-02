import { describe, it, expect } from "vitest";
import {
  mapProduct,
  listActiveProducts,
  getProductById,
  getProductsByIds,
  getProductImages,
  registerView,
  type ProductQueryRow,
} from "@/services/product.service";
import { mockSupabase } from "@/services/test-utils/supabase-mock";

function baseRow(overrides: Partial<ProductQueryRow> = {}): ProductQueryRow {
  return {
    id: "p1",
    seller_id: "s1",
    category_id: "c1",
    title: "Laptop",
    description: "desc",
    price: "1999.90",
    stock: 5,
    condition: "nuevo",
    brand: "Acme",
    is_active: true,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    product_images: [],
    reviews: [],
    ...overrides,
  } as unknown as ProductQueryRow;
}

describe("product.service.mapProduct", () => {
  it("convierte price (numeric → string en Postgres) a number", () => {
    const product = mapProduct(baseRow());
    expect(product.price).toBe(1999.9);
    expect(typeof product.price).toBe("number");
  });

  it("elige como portada la image_path de menor position, sin importar el orden de llegada", () => {
    const supabase = mockSupabase({});
    const product = mapProduct(
      baseRow({
        product_images: [
          { image_path: "s1/p1/2.jpg", position: 2 },
          { image_path: "s1/p1/0.jpg", position: 0 },
          { image_path: "s1/p1/1.jpg", position: 1 },
        ],
      }),
      supabase,
    );
    expect(product.image_url).toContain("s1/p1/0.jpg");
  });

  it("sin imágenes: image_url es null (no llama a getPublicUrl)", () => {
    const product = mapProduct(baseRow({ product_images: [] }));
    expect(product.image_url).toBeNull();
  });

  it("promedia el rating de las reviews y cuenta review_count", () => {
    const product = mapProduct(
      baseRow({ reviews: [{ rating: 4 }, { rating: 5 }, { rating: 3 }] }),
    );
    expect(product.average_rating).toBe(4);
    expect(product.review_count).toBe(3);
  });

  it("sin reviews: average_rating es null, no NaN ni 0", () => {
    const product = mapProduct(baseRow({ reviews: [] }));
    expect(product.average_rating).toBeNull();
    expect(product.review_count).toBe(0);
  });
});

describe("product.service.listActiveProducts", () => {
  it("filtra por is_active=true explícito siempre, incluso sin otros filtros", async () => {
    const supabase = mockSupabase({
      products: { select: [baseRow()], count: 1 },
    });

    await listActiveProducts({}, supabase);

    const call = supabase.calls.find((c) => c.table === "products" && c.op === "select");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["is_active", true] });
  });

  it("sellerId: filtra por seller_id, sin consultar categories (storefront público, fuera del PDF de la spec)", async () => {
    const supabase = mockSupabase({
      products: { select: [baseRow()], count: 1 },
    });

    await listActiveProducts({ sellerId: "s1" }, supabase);

    const call = supabase.calls.find((c) => c.table === "products" && c.op === "select");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["seller_id", "s1"] });
    expect(supabase.calls.some((c) => c.table === "categories")).toBe(false);
  });

  it("resuelve categorySlug a category_id vía un select previo a categories", async () => {
    const supabase = mockSupabase({
      categories: { single: { id: "cat-42" } },
      products: { select: [baseRow()], count: 1 },
    });

    await listActiveProducts({ categorySlug: "laptops" }, supabase);

    const call = supabase.calls.find((c) => c.table === "products" && c.op === "select");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["category_id", "cat-42"] });
  });

  it("propaga el error si el slug de categoría no existe", async () => {
    const supabase = mockSupabase({
      categories: { error: { message: "no encontrado", code: "PGRST116" } },
    });

    await expect(listActiveProducts({ categorySlug: "no-existe" }, supabase)).rejects.toMatchObject({
      message: "no encontrado",
    });
  });

  it("search: usa .or() con ilike sobre title y brand (búsqueda provisional)", async () => {
    const supabase = mockSupabase({
      products: { select: [baseRow()], count: 1 },
    });

    await listActiveProducts({ search: "acme" }, supabase);

    const call = supabase.calls.find((c) => c.table === "products" && c.op === "select");
    expect(call?.chain).toContainEqual({
      method: "or",
      args: ["title.ilike.%acme%,brand.ilike.%acme%"],
    });
  });

  it("condition, minPrice y maxPrice arman in/gte/lte", async () => {
    const supabase = mockSupabase({
      products: { select: [baseRow()], count: 1 },
    });

    await listActiveProducts(
      { condition: ["nuevo", "usado"], minPrice: 100, maxPrice: 500 },
      supabase,
    );

    const call = supabase.calls.find((c) => c.table === "products" && c.op === "select");
    expect(call?.chain).toContainEqual({ method: "in", args: ["condition", ["nuevo", "usado"]] });
    expect(call?.chain).toContainEqual({ method: "gte", args: ["price", 100] });
    expect(call?.chain).toContainEqual({ method: "lte", args: ["price", 500] });
  });

  it("hideOutOfStock arma gt('stock', 0); sin el filtro, no se agrega (Fase 7.5)", async () => {
    const supabase = mockSupabase({ products: { select: [baseRow()], count: 1 } });

    await listActiveProducts({ hideOutOfStock: true }, supabase);
    const withFilter = supabase.calls.filter((c) => c.table === "products" && c.op === "select").at(-1);
    expect(withFilter?.chain).toContainEqual({ method: "gt", args: ["stock", 0] });

    await listActiveProducts({}, supabase);
    const withoutFilter = supabase.calls.filter((c) => c.table === "products" && c.op === "select").at(-1);
    expect(withoutFilter?.chain.some((c) => c.method === "gt")).toBe(false);
  });

  it("sort=precio_asc/precio_desc ordena por price; sin sort, por created_at desc", async () => {
    const supabase = mockSupabase({ products: { select: [baseRow()], count: 1 } });
    await listActiveProducts({ sort: "precio_asc" }, supabase);
    let call = supabase.calls.filter((c) => c.table === "products" && c.op === "select").at(-1);
    expect(call?.chain).toContainEqual({ method: "order", args: ["price", { ascending: true }] });

    const supabase2 = mockSupabase({ products: { select: [baseRow()], count: 1 } });
    await listActiveProducts({}, supabase2);
    call = supabase2.calls.filter((c) => c.table === "products" && c.op === "select").at(-1);
    expect(call?.chain).toContainEqual({ method: "order", args: ["created_at", { ascending: false }] });
  });

  it("total sale de count, no de data.length (página parcial)", async () => {
    const supabase = mockSupabase({
      products: { select: [baseRow(), baseRow({ id: "p2" })], count: 37 },
    });

    const { items, total } = await listActiveProducts({}, supabase);

    expect(items).toHaveLength(2);
    expect(total).toBe(37);
  });

  it("propaga el error de la query principal tal cual", async () => {
    const supabase = mockSupabase({
      products: { error: { message: "syntax error in ilike" } },
    });

    await expect(listActiveProducts({}, supabase)).rejects.toMatchObject({
      message: "syntax error in ilike",
    });
  });
});

describe("product.service.getProductById / getProductsByIds", () => {
  it("getProductById mapea la fila única", async () => {
    const supabase = mockSupabase({ products: { single: baseRow({ id: "p9" }) } });
    const product = await getProductById("p9", supabase);
    expect(product.id).toBe("p9");
  });

  it("getProductsByIds con arreglo vacío no consulta la base", async () => {
    const supabase = mockSupabase({});
    const result = await getProductsByIds([], supabase);
    expect(result).toEqual([]);
    expect(supabase.calls).toHaveLength(0);
  });

  it("getProductsByIds usa .in() y mapea cada fila", async () => {
    const supabase = mockSupabase({
      products: { select: [baseRow({ id: "p1" }), baseRow({ id: "p2" })] },
    });
    const result = await getProductsByIds(["p1", "p2"], supabase);
    expect(result.map((p) => p.id)).toEqual(["p1", "p2"]);
    const call = supabase.calls.find((c) => c.table === "products" && c.op === "select");
    expect(call?.chain).toContainEqual({ method: "in", args: ["id", ["p1", "p2"]] });
  });
});

describe("product.service.getProductImages", () => {
  it("ordena por position y resuelve image_url de cada una", async () => {
    const supabase = mockSupabase({
      product_images: {
        select: [
          { id: "i1", product_id: "p1", image_path: "s1/p1/0.jpg", position: 0 },
        ],
      },
    });

    const images = await getProductImages("p1", supabase);

    expect(images[0].image_url).toContain("s1/p1/0.jpg");
    const call = supabase.calls.find((c) => c.table === "product_images" && c.op === "select");
    expect(call?.chain).toContainEqual({ method: "order", args: ["position"] });
  });
});

describe("product.service.registerView", () => {
  it("inserta product_id + user_id", async () => {
    const supabase = mockSupabase({ product_views: {} });
    await registerView("p1", "u1", supabase);
    expect(supabase.inserts("product_views")).toContainEqual({ product_id: "p1", user_id: "u1" });
  });

  it("propaga el error tal cual (fire-and-forget lo maneja el caller, no este service)", async () => {
    const supabase = mockSupabase({
      product_views: { error: { message: "duplicate key value" } },
    });
    await expect(registerView("p1", "u1", supabase)).rejects.toMatchObject({
      message: "duplicate key value",
    });
  });
});
