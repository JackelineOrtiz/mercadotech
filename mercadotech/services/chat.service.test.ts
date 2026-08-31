import { describe, it, expect, vi } from "vitest";
import { ask } from "@/services/chat.service";
import { mockSupabase } from "@/services/test-utils/supabase-mock";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { generateCompletion } from "@/lib/ai/completion";

// Único mock de módulo sancionado (lib/ai/* no tiene cliente inyectable).
// buildContext (lib/ai/context-builder) se deja REAL a propósito: ya está
// probado en su propio archivo (Fase 6.2) y acá interesa la orquestación
// completa búsqueda → contexto → completion (decisión de la spec), no
// reimplementar su lógica de selección con un doble.
vi.mock("@/lib/ai/embeddings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/embeddings")>();
  return { ...actual, generateEmbedding: vi.fn(async () => [0.1, 0.2]) };
});
vi.mock("@/lib/ai/completion", () => ({
  generateCompletion: vi.fn(async () => ({
    text: "Respuesta generada",
    model: "meta-llama/Llama-3.1-8B-Instruct",
    stopReason: "stop",
  })),
}));

const mockedGenerateEmbedding = vi.mocked(generateEmbedding);
const mockedGenerateCompletion = vi.mocked(generateCompletion);

function supabaseWithMatches(matches: unknown[]) {
  return mockSupabase({}, { rpc: { match_knowledge: { data: matches, error: null } } });
}

describe("chat.service.ask", () => {
  it("orquesta en orden: búsqueda (embedding+RPC) → contexto → completion", async () => {
    mockedGenerateEmbedding.mockClear();
    mockedGenerateCompletion.mockClear();
    const supabase = supabaseWithMatches([
      {
        source_type: "producto",
        source_id: "p1",
        content: "Una laptop gamer con 16GB de RAM y buena batería.",
        metadata: { title: "Laptop Gamer", price: 1500, category: "Laptops" },
        similarity: 0.8,
      },
    ]);

    const result = await ask("¿tienen laptops gamer?", "compras", {}, supabase);

    expect(mockedGenerateEmbedding).toHaveBeenCalledBefore(mockedGenerateCompletion);
    expect(supabase.rpcCalls).toHaveLength(1);
    expect(result.answer).toBe("Respuesta generada");
    expect(result.hasRelevantContext).toBe(true);
    expect(result.sources).toHaveLength(1);
    expect(result.metadata).toEqual({
      model: "meta-llama/Llama-3.1-8B-Instruct",
      retrievedCount: 1,
      usedSourceCount: 1,
      contextTruncated: false,
    });
  });

  it("mode='compras' busca sourceType='producto'; mode='soporte' busca 'articulo_soporte'", async () => {
    const supabaseCompras = supabaseWithMatches([]);
    await ask("hola", "compras", {}, supabaseCompras);
    expect(supabaseCompras.rpcCalls[0].args).toMatchObject({ p_source_type: "producto" });

    const supabaseSoporte = supabaseWithMatches([]);
    await ask("hola", "soporte", {}, supabaseSoporte);
    expect(supabaseSoporte.rpcCalls[0].args).toMatchObject({ p_source_type: "articulo_soporte" });
  });

  it("hasRelevantContext=false (ninguna ficha pasó el filtro) IGUAL llama a completion — el modelo debe poder admitir que no sabe", async () => {
    mockedGenerateCompletion.mockClear();
    const supabase = supabaseWithMatches([]); // sin matches en absoluto

    const result = await ask("pregunta sin fichas relevantes", "compras", {}, supabase);

    expect(result.hasRelevantContext).toBe(false);
    expect(result.sources).toEqual([]);
    expect(mockedGenerateCompletion).toHaveBeenCalledOnce();
  });

  it("propaga el error de la RPC de búsqueda tal cual, sin llegar a completion", async () => {
    mockedGenerateCompletion.mockClear();
    const supabase = mockSupabase(
      {},
      { rpc: { match_knowledge: { error: { message: "función no encontrada" } } } },
    );

    await expect(ask("hola", "compras", {}, supabase)).rejects.toMatchObject({
      message: "función no encontrada",
    });
    expect(mockedGenerateCompletion).not.toHaveBeenCalled();
  });
});
