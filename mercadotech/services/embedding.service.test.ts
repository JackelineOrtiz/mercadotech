import { describe, it, expect, vi } from "vitest";
import {
  indexProduct,
  indexSupportArticle,
  indexSource,
  isSourceNotFoundError,
  removeEmbeddings,
} from "@/services/embedding.service";
import { mockSupabase } from "@/services/test-utils/supabase-mock";

// Único mock de módulo sancionado por la spec (decisión 7): lib/ai/* no
// tiene cliente Supabase inyectable, así que se mockea el módulo entero.
// Se mantienen buildProductEmbeddingText/buildSupportArticleEmbeddingText
// REALES (funciones puras, sin red) vía importOriginal — solo se
// reemplaza generateEmbedding, la única que hace una llamada de red real.
vi.mock("@/lib/ai/embeddings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/embeddings")>();
  return {
    ...actual,
    generateEmbedding: vi.fn(async () => [0.1, 0.2, 0.3]),
  };
});

const productRow = {
  id: "p1",
  seller_id: "s1",
  category_id: "c1",
  title: "Laptop X",
  description: "Una laptop",
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

describe("embedding.service.indexProduct", () => {
  it("arma el content, genera el embedding y hace upsert con onConflict de la clave compuesta", async () => {
    const supabase = mockSupabase({
      products: { single: productRow },
      categories: { single: { name: "Laptops" } },
      knowledge_embeddings: {},
    });

    await indexProduct("p1", supabase);

    const call = supabase.calls.find((c) => c.table === "knowledge_embeddings" && c.op === "upsert");
    expect(call).toBeDefined();
    const payload = call!.payload as Record<string, unknown>;
    expect(payload.source_type).toBe("producto");
    expect(payload.source_id).toBe("p1");
    expect(payload.chunk_index).toBe(0);
    expect(payload.embedding).toBe("[0.1,0.2,0.3]");
    expect(payload.metadata).toEqual({
      title: "Laptop X",
      price: 999,
      category: "Laptops",
      image_url: null,
    });
    expect(call!.chain).toContainEqual({
      method: "upsert-options",
      args: [{ onConflict: "source_type,source_id,chunk_index" }],
    });
  });

  it("propaga el error de leer la categoría tal cual", async () => {
    const supabase = mockSupabase({
      products: { single: productRow },
      categories: { error: { message: "no encontrado" } },
    });
    await expect(indexProduct("p1", supabase)).rejects.toMatchObject({ message: "no encontrado" });
  });
});

describe("embedding.service.indexSupportArticle", () => {
  it("arma el content del artículo y hace upsert con source_type='articulo_soporte'", async () => {
    const supabase = mockSupabase({
      support_articles: {
        single: { id: "a1", title: "Cómo hacer un reclamo", content: "Pasos...", category: "Reclamos" },
      },
      knowledge_embeddings: {},
    });

    await indexSupportArticle("a1", supabase);

    const call = supabase.calls.find((c) => c.table === "knowledge_embeddings" && c.op === "upsert");
    const payload = call!.payload as Record<string, unknown>;
    expect(payload.source_type).toBe("articulo_soporte");
    expect(payload.source_id).toBe("a1");
    expect(payload.metadata).toEqual({ title: "Cómo hacer un reclamo", category: "Reclamos" });
  });
});

describe("embedding.service.indexSource", () => {
  it("sourceType='producto' delega en indexProduct", async () => {
    const supabase = mockSupabase({
      products: { single: productRow },
      categories: { single: { name: "Laptops" } },
      knowledge_embeddings: {},
    });
    await indexSource("producto", "p1", supabase);
    expect(supabase.upserts("knowledge_embeddings")[0]).toMatchObject({ source_type: "producto" });
  });

  it("sourceType='articulo_soporte' delega en indexSupportArticle", async () => {
    const supabase = mockSupabase({
      support_articles: { single: { id: "a1", title: "T", content: "C", category: null } },
      knowledge_embeddings: {},
    });
    await indexSource("articulo_soporte", "a1", supabase);
    expect(supabase.upserts("knowledge_embeddings")[0]).toMatchObject({ source_type: "articulo_soporte" });
  });
});

describe("embedding.service.isSourceNotFoundError", () => {
  it("true solo para el código PGRST116", () => {
    expect(isSourceNotFoundError({ code: "PGRST116" })).toBe(true);
  });

  it("false para otros códigos, valores no-objeto, null o sin code", () => {
    expect(isSourceNotFoundError({ code: "42501" })).toBe(false);
    expect(isSourceNotFoundError(new Error("boom"))).toBe(false);
    expect(isSourceNotFoundError(null)).toBe(false);
    expect(isSourceNotFoundError("PGRST116")).toBe(false);
    expect(isSourceNotFoundError({})).toBe(false);
  });
});

describe("embedding.service.removeEmbeddings", () => {
  it("borra filtrando por source_type y source_id", async () => {
    const supabase = mockSupabase({ knowledge_embeddings: {} });
    await removeEmbeddings("producto", "p1", supabase);
    const call = supabase.calls.find((c) => c.table === "knowledge_embeddings" && c.op === "delete");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["source_type", "producto"] });
    expect(call?.chain).toContainEqual({ method: "eq", args: ["source_id", "p1"] });
  });

  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase({ knowledge_embeddings: { error: { message: "permission denied" } } });
    await expect(removeEmbeddings("producto", "p1", supabase)).rejects.toMatchObject({
      message: "permission denied",
    });
  });
});
