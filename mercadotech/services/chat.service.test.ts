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

  // Fase 7.5, hallazgo real validando el asistente con datos reales: antes
  // de este cambio, con context vacío IGUAL se llamaba a completion, y el
  // modelo gratuito de Hugging Face no siempre respetaba la instrucción de
  // admitir que no sabe — en varios casos inventó productos/precios/citas
  // de artículos que no existen. Corte determinístico: sin fuentes, ni
  // se llama al modelo — respuesta fija, cero riesgo de alucinar.
  it("hasRelevantContext=false (ninguna ficha pasó el filtro): NO llama a completion, responde fijo por mode", async () => {
    mockedGenerateCompletion.mockClear();
    const supabaseCompras = supabaseWithMatches([]);
    const resultCompras = await ask("pregunta sin fichas relevantes", "compras", {}, supabaseCompras);

    expect(resultCompras.hasRelevantContext).toBe(false);
    expect(resultCompras.sources).toEqual([]);
    expect(resultCompras.answer).toMatch(/no encontré productos/i);
    expect(mockedGenerateCompletion).not.toHaveBeenCalled();

    const supabaseSoporte = supabaseWithMatches([]);
    const resultSoporte = await ask("pregunta sin fichas relevantes", "soporte", {}, supabaseSoporte);
    expect(resultSoporte.answer).toMatch(/no tengo información/i);
    expect(mockedGenerateCompletion).not.toHaveBeenCalled();
  });

  // Fase 7.5, hallazgo real: el chat no tenía memoria de conversación —
  // cada mensaje era una consulta independiente. Con historial, un
  // contexto vacío YA NO es el atajo sin-modelo: una réplica vaga ("¿esa
  // tiene buena batería?") retrieva vacío a propósito, pero el modelo
  // puede seguir respondiendo con lo ya establecido en turnos previos.
  it("con historial y contexto vacío: SÍ llama a completion (a diferencia de sin historial), pasándole el historial", async () => {
    mockedGenerateCompletion.mockClear();
    const supabase = supabaseWithMatches([]);
    const history = [
      { role: "user" as const, content: "¿tienen laptops?" },
      { role: "assistant" as const, content: "Sí, la Lenovo IdeaPad 3 [1]." },
    ];

    const result = await ask("¿esa tiene buena batería?", "compras", {}, supabase, history);

    expect(mockedGenerateCompletion).toHaveBeenCalledOnce();
    expect(mockedGenerateCompletion).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      history,
    );
    // hasRelevantContext sigue siendo false de verdad: no hay fuentes
    // NUEVAS en este turno, aunque sí se haya llamado al modelo.
    expect(result.hasRelevantContext).toBe(false);
    expect(result.sources).toEqual([]);
  });

  it("con fuentes reales: le pasa el historial a completion en el orden real", async () => {
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
    const history = [{ role: "user" as const, content: "hola" }];

    await ask("¿tienen laptops gamer?", "compras", {}, supabase, history);

    expect(mockedGenerateCompletion).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      history,
    );
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
