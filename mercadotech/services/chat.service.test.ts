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

  // Fase 7.5, hallazgo real (subagente: 18 hilos con réplicas, 16 con
  // problemas): sin esto, la búsqueda de una réplica vaga ("¿cuál de esas
  // dos es más liviana?") solo usaba ese texto, sin ningún término de
  // producto, y traía fichas random — el modelo terminaba respondiendo
  // sobre productos no relacionados en vez de usar el historial.
  it("la búsqueda combina el/los último(s) turno(s) del historial con la pregunta actual (nunca sin historial)", async () => {
    mockedGenerateEmbedding.mockClear();
    const supabaseSinHistorial = supabaseWithMatches([]);
    await ask("hola", "compras", {}, supabaseSinHistorial);
    expect(mockedGenerateEmbedding).toHaveBeenCalledWith("hola");

    mockedGenerateEmbedding.mockClear();
    const supabaseConHistorial = supabaseWithMatches([]);
    const history = [
      { role: "user" as const, content: "tienen laptop lenovo ideapad 3" },
      { role: "assistant" as const, content: "Sí, la Lenovo IdeaPad 3 [1]." },
    ];
    await ask("¿esa tiene buena batería?", "compras", {}, supabaseConHistorial, history);
    expect(mockedGenerateEmbedding).toHaveBeenCalledWith(
      "tienen laptop lenovo ideapad 3\nSí, la Lenovo IdeaPad 3 [1].\n¿esa tiene buena batería?",
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

  // Fase 7.5, hallazgo real validando el asistente en vivo: con UNA sola
  // fuente recuperada (una cámara, para "qué laptop me recomiendas para
  // diseño"), el modelo citó esa fuente [1] como "no relacionada" y
  // ADEMÁS inventó 3 laptops que no existen en el catálogo, citándolas
  // como [2], [3] y [4] — números que no corresponden a ninguna fuente
  // real (solo había 1). Corte determinístico post-generación: un citado
  // fuera de rango descarta la respuesta entera.
  describe("citó una fuente que no existe (índice fuera de rango)", () => {
    it("1 sola fuente real pero el texto cita [2]: descarta la respuesta, no llega al cliente", async () => {
      mockedGenerateCompletion.mockClear();
      mockedGenerateCompletion.mockResolvedValueOnce({
        text: 'El producto [1] no se relaciona con tu pedido. Te recomiendo la laptop [2], ideal para diseño.',
        model: "meta-llama/Llama-3.1-8B-Instruct",
        stopReason: "stop",
      });
      const supabase = supabaseWithMatches([
        {
          source_type: "producto",
          source_id: "p1",
          content: "Cámara de acción Insta360 ONE X2, resistente al agua.",
          metadata: { title: "Insta360 ONE X2", price: 6660000, category: "Accesorios" },
          similarity: 0.75,
        },
      ]);

      const result = await ask("qué laptop me recomiendas para diseño", "compras", {}, supabase);

      expect(result.answer).toMatch(/no encontré productos/i);
      expect(result.hasRelevantContext).toBe(false);
      expect(result.sources).toEqual([]);
      expect(result.metadata.usedSourceCount).toBe(0);
    });

    it("cita solo índices dentro de rango: no descarta la respuesta real", async () => {
      mockedGenerateCompletion.mockClear();
      mockedGenerateCompletion.mockResolvedValueOnce({
        text: "La laptop [1] es una buena opción para diseño.",
        model: "meta-llama/Llama-3.1-8B-Instruct",
        stopReason: "stop",
      });
      const supabase = supabaseWithMatches([
        {
          source_type: "producto",
          source_id: "p1",
          content: "Laptop para diseño gráfico, 32GB RAM.",
          metadata: { title: "Laptop Diseño Pro", price: 3200000, category: "Laptops" },
          similarity: 0.9,
        },
      ]);

      const result = await ask("qué laptop me recomiendas para diseño", "compras", {}, supabase);

      expect(result.answer).toBe("La laptop [1] es una buena opción para diseño.");
      expect(result.hasRelevantContext).toBe(true);
      expect(result.sources).toHaveLength(1);
    });
  });
});
