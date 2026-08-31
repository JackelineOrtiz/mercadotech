import { describe, it, expect, vi } from "vitest";
import { searchByEmbedding, searchProducts } from "@/services/vector-search.service";
import { mockSupabase } from "@/services/test-utils/supabase-mock";
import {
  VECTOR_SEARCH_DEFAULT_TOP_K,
  VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD,
} from "@/lib/constants/ai";

vi.mock("@/lib/ai/embeddings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/embeddings")>();
  return {
    ...actual,
    generateEmbedding: vi.fn(async () => [0.4, 0.5]),
  };
});

describe("vector-search.service.searchByEmbedding", () => {
  it("llama a la RPC match_knowledge serializando el vector y con los defaults de lib/constants/ai", async () => {
    const supabase = mockSupabase(
      {},
      { rpc: { match_knowledge: { data: [], error: null } } },
    );

    await searchByEmbedding([0.1, 0.2], {}, supabase);

    expect(supabase.rpcCalls).toContainEqual({
      name: "match_knowledge",
      args: {
        query_embedding: "[0.1,0.2]",
        p_source_type: undefined,
        match_count: VECTOR_SEARCH_DEFAULT_TOP_K,
        similarity_threshold: VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD,
      },
    });
  });

  it("respeta topK/threshold/sourceType explícitos", async () => {
    const supabase = mockSupabase({}, { rpc: { match_knowledge: { data: [], error: null } } });
    await searchByEmbedding([0.1], { sourceType: "articulo_soporte", topK: 3, threshold: 0.9 }, supabase);
    expect(supabase.rpcCalls[0].args).toMatchObject({
      p_source_type: "articulo_soporte",
      match_count: 3,
      similarity_threshold: 0.9,
    });
  });

  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase(
      {},
      { rpc: { match_knowledge: { error: { message: "function match_knowledge does not exist" } } } },
    );
    await expect(searchByEmbedding([0.1], {}, supabase)).rejects.toMatchObject({
      message: "function match_knowledge does not exist",
    });
  });
});

const productRow = (id: string) => ({
  id,
  seller_id: "s1",
  category_id: "c1",
  title: `Producto ${id}`,
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
});

describe("vector-search.service.searchProducts", () => {
  it("sin matches: [] sin siquiera consultar products", async () => {
    const supabase = mockSupabase({}, { rpc: { match_knowledge: { data: [], error: null } } });
    const results = await searchProducts("laptop", {}, supabase);
    expect(results).toEqual([]);
    expect(supabase.calls.some((c) => c.table === "products")).toBe(false);
  });

  it("hidrata contra products, filtra is_active=true, y ordena por similitud descendente", async () => {
    const supabase = mockSupabase(
      {
        products: { select: [productRow("p1"), productRow("p2")] },
      },
      {
        rpc: {
          match_knowledge: {
            data: [
              { source_type: "producto", source_id: "p1", content: "c", metadata: {}, similarity: 0.7 },
              { source_type: "producto", source_id: "p2", content: "c", metadata: {}, similarity: 0.95 },
            ],
            error: null,
          },
        },
      },
    );

    const results = await searchProducts("laptop", {}, supabase);

    expect(results.map((r) => r.id)).toEqual(["p2", "p1"]);
    expect(results[0].similarity).toBe(0.95);
    const call = supabase.calls.find((c) => c.table === "products" && c.op === "select");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["is_active", true] });
    expect(call?.chain).toContainEqual({ method: "in", args: ["id", ["p1", "p2"]] });
  });

  it("descarta huérfanos: un match cuyo producto ya no existe o está inactivo simplemente no aparece", async () => {
    // match_knowledge devolvió p1 y p2 (fichó ambos alguna vez), pero
    // products (con el filtro is_active=true) solo trae p1 — p2 se borró o
    // se desactivó después de fichado (decisión 6 de la spec).
    const supabase = mockSupabase(
      { products: { select: [productRow("p1")] } },
      {
        rpc: {
          match_knowledge: {
            data: [
              { source_type: "producto", source_id: "p1", content: "c", metadata: {}, similarity: 0.8 },
              { source_type: "producto", source_id: "p2", content: "c", metadata: {}, similarity: 0.9 },
            ],
            error: null,
          },
        },
      },
    );

    const results = await searchProducts("laptop", {}, supabase);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("p1");
  });
});
