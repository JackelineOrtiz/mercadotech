import { describe, it, expect } from "vitest";
import { isFavorite, toggle, listMine } from "@/services/favorite.service";
import { mockSupabase } from "@/services/test-utils/supabase-mock";

describe("favorite.service.isFavorite", () => {
  it("true cuando existe la fila", async () => {
    const supabase = mockSupabase({ favorites: { maybeSingle: { id: "f1" } } });
    expect(await isFavorite("u1", "p1", supabase)).toBe(true);
  });

  it("false cuando no existe (maybeSingle null)", async () => {
    const supabase = mockSupabase({ favorites: { maybeSingle: null } });
    expect(await isFavorite("u1", "p1", supabase)).toBe(false);
  });
});

describe("favorite.service.toggle", () => {
  it("ya era favorito: borra y devuelve false", async () => {
    const supabase = mockSupabase({ favorites: { maybeSingle: { id: "f1" } } });
    const result = await toggle("u1", "p1", supabase);
    expect(result).toBe(false);
    expect(supabase.deletes("favorites")).toHaveLength(1);
    expect(supabase.inserts("favorites")).toHaveLength(0);
  });

  it("no era favorito: inserta y devuelve true", async () => {
    const supabase = mockSupabase({ favorites: { maybeSingle: null } });
    const result = await toggle("u1", "p1", supabase);
    expect(result).toBe(true);
    expect(supabase.inserts("favorites")).toContainEqual({ user_id: "u1", product_id: "p1" });
  });
});

describe("favorite.service.listMine", () => {
  it("filtra productos null (inactivos, ocultos por RLS) sin fallar", async () => {
    const productRow = {
      id: "p1",
      seller_id: "s1",
      category_id: "c1",
      title: "Laptop",
      description: "d",
      price: "100.00",
      stock: 1,
      condition: "nuevo",
      brand: "Acme",
      is_active: true,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      product_images: [],
      reviews: [],
    };
    const supabase = mockSupabase({
      favorites: {
        select: [{ products: productRow }, { products: null }],
      },
    });

    const products = await listMine("u1", supabase);

    expect(products).toHaveLength(1);
    expect(products[0].id).toBe("p1");
  });

  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase({ favorites: { error: { message: "permission denied" } } });
    await expect(listMine("u1", supabase)).rejects.toMatchObject({ message: "permission denied" });
  });
});
