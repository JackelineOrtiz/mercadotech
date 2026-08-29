import { describe, it, expect } from "vitest";
import { buildContext, type ContextCandidate } from "@/lib/ai/context-builder";
import {
  CONTEXT_BUILDER_DEFAULT_MAX_SOURCES,
  CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY,
  CONTEXT_BUILDER_MIN_CONTENT_LENGTH,
  CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS,
} from "@/lib/constants/ai";

// Sin mocks (función pura: cero red, cero Supabase, cero React — así se
// diseñó a propósito en la Sesión 4 para poder testearse aquí). Los
// valores límite salen de las constantes reales importadas.

function candidate(overrides: Partial<ContextCandidate> = {}): ContextCandidate {
  return {
    source_type: "producto",
    source_id: "b0000000-0000-0000-0000-000000000001",
    content: "a".repeat(CONTEXT_BUILDER_MIN_CONTENT_LENGTH), // válido por defecto
    similarity: 0.9,
    metadata: { title: "Producto de prueba" },
    ...overrides,
  };
}

describe("buildContext — selección", () => {
  it("lista vacía: sin fuentes, sin truncar", () => {
    const result = buildContext("query", []);
    expect(result.sources).toEqual([]);
    expect(result.stats.contextTruncated).toBe(false);
    expect(result.stats.totalChars).toBe(0);
  });

  it("todo bajo el umbral de similitud: se descarta, aunque el arreglo no esté vacío", () => {
    const belowThreshold = CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY - 0.01;
    const result = buildContext("query", [candidate({ similarity: belowThreshold })]);
    expect(result.sources).toEqual([]);
  });

  it("filtra por similitud mínima: exactamente en el umbral SÍ pasa (>=)", () => {
    const result = buildContext("query", [
      candidate({ similarity: CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY }),
    ]);
    expect(result.sources).toHaveLength(1);
  });

  it("filtra por longitud mínima de contenido, aunque la similitud sea alta", () => {
    const result = buildContext("query", [
      candidate({ similarity: 0.99, content: "a".repeat(CONTEXT_BUILDER_MIN_CONTENT_LENGTH - 1) }),
    ]);
    expect(result.sources).toEqual([]);
  });

  it("respeta maxSources y marca contextTruncated aunque el presupuesto de caracteres sobre", () => {
    const candidates = [
      candidate({ source_id: "1", similarity: 0.5 }),
      candidate({ source_id: "2", similarity: 0.9 }),
      candidate({ source_id: "3", similarity: 0.7 }),
    ];
    const result = buildContext("query", candidates, { maxSources: 2, maxContextChars: 10_000 });

    expect(result.sources).toHaveLength(2);
    expect(result.stats.contextTruncated).toBe(true);
    // orden estable por similitud descendente: 0.9 primero, 0.7 segundo — el de 0.5 queda afuera
    expect(result.sources[0].source_id).toBe("2");
    expect(result.sources[1].source_id).toBe("3");
  });

  it("orden estable por similitud descendente, sin importar el orden de entrada", () => {
    const candidates = [
      candidate({ source_id: "bajo", similarity: 0.4 }),
      candidate({ source_id: "alto", similarity: 0.95 }),
      candidate({ source_id: "medio", similarity: 0.6 }),
    ];
    const result = buildContext("query", candidates, { maxContextChars: 10_000 });

    expect(result.sources.map((s) => s.source_id)).toEqual(["alto", "medio", "bajo"]);
    expect(result.sources.map((s) => s.index)).toEqual([1, 2, 3]);
  });

  it("opts explícitos reemplazan los defaults (maxSources, minSimilarity, maxContextChars)", () => {
    const belowDefaultButAboveCustom = CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY - 0.1;
    const result = buildContext(
      "query",
      [candidate({ similarity: belowDefaultButAboveCustom })],
      { minSimilarity: belowDefaultButAboveCustom, maxContextChars: 10_000 },
    );
    // con el default esta fuente se habría descartado; con el opt explícito, pasa
    expect(result.sources).toHaveLength(1);
  });

  it("usa CONTEXT_BUILDER_DEFAULT_MAX_SOURCES cuando no se pasa maxSources", () => {
    const many = Array.from({ length: CONTEXT_BUILDER_DEFAULT_MAX_SOURCES + 2 }, (_, i) =>
      candidate({ source_id: String(i), similarity: 0.5 + i * 0.01 }),
    );
    const result = buildContext("query", many, { maxContextChars: 100_000 });
    expect(result.sources).toHaveLength(CONTEXT_BUILDER_DEFAULT_MAX_SOURCES);
  });
});

describe("buildContext — presupuesto de caracteres", () => {
  it("todo cabe entero: sin truncar", () => {
    const result = buildContext(
      "query",
      [candidate({ content: "a".repeat(50) })],
      { maxContextChars: 100 },
    );
    expect(result.stats.contextTruncated).toBe(false);
    expect(result.stats.totalChars).toBe(50);
  });

  it("sin espacio en absoluto para la siguiente fuente (remaining <= 0): se corta ahí, marcado truncado", () => {
    const result = buildContext(
      "query",
      [candidate({ source_id: "1", content: "a".repeat(100) }), candidate({ source_id: "2", similarity: 0.5 })],
      { maxContextChars: 100 },
    );
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].source_id).toBe("1");
    expect(result.stats.contextTruncated).toBe(true);
  });

  it("si lo que resta del presupuesto es MENOR que el mínimo truncado, la fuente se descarta ENTERA", () => {
    const remaining = CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS - 1;
    const result = buildContext(
      "query",
      [candidate({ content: "a".repeat(remaining + 50) })], // no cabe entera, y lo que sobra no alcanza el mínimo
      { maxContextChars: remaining },
    );
    expect(result.sources).toEqual([]);
    expect(result.stats.totalChars).toBe(0);
    expect(result.stats.contextTruncated).toBe(true);
  });

  it("si lo que resta alcanza el mínimo truncado, la fuente se incluye TRUNCADA (no entera)", () => {
    const remaining = CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS;
    const result = buildContext(
      "query",
      [candidate({ content: "a".repeat(remaining + 50) })],
      { maxContextChars: remaining },
    );
    expect(result.sources).toHaveLength(1);
    expect(result.stats.totalChars).toBe(remaining);
    expect(result.stats.contextTruncated).toBe(true);
  });
});

describe("buildContext — metadata → ContextSource", () => {
  it("producto: título, price numérico e image_url string se extraen de metadata", () => {
    const result = buildContext("query", [
      candidate({
        metadata: { title: "Laptop Lenovo", price: 2199, image_url: "https://x/1.jpg", category: "Laptops" },
      }),
    ]);
    expect(result.sources[0]).toMatchObject({
      title: "Laptop Lenovo",
      price: 2199,
      image_url: "https://x/1.jpg",
      category: "Laptops",
    });
  });

  it("image_url null (producto sin imágenes) se preserva como null, no undefined", () => {
    const result = buildContext("query", [candidate({ metadata: { title: "X", image_url: null } })]);
    expect(result.sources[0].image_url).toBeNull();
  });

  it("artículo de soporte: sin price ni image_url en metadata → quedan undefined", () => {
    const result = buildContext("query", [
      candidate({ source_type: "articulo_soporte", metadata: { title: "FAQ", category: "envíos" } }),
    ]);
    expect(result.sources[0].price).toBeUndefined();
    expect(result.sources[0].image_url).toBeUndefined();
    expect(result.sources[0].category).toBe("envíos");
  });

  it("sin título en metadata: cae a string vacío, nunca undefined", () => {
    const result = buildContext("query", [candidate({ metadata: {} })]);
    expect(result.sources[0].title).toBe("");
  });

  it("price con tipo incorrecto en metadata (no number) se descarta, no se cuela", () => {
    const result = buildContext("query", [candidate({ metadata: { title: "X", price: "2199" } })]);
    expect(result.sources[0].price).toBeUndefined();
  });
});

describe("buildContext — userMessage", () => {
  it("delega en buildRagUserMessage con las fuentes incluidas, no las descartadas", () => {
    const result = buildContext(
      "laptop para diseño",
      [candidate({ content: "Laptop HP Pavilion.".padEnd(CONTEXT_BUILDER_MIN_CONTENT_LENGTH, " ") })],
    );
    expect(result.userMessage).toContain("laptop para diseño");
    expect(result.userMessage).toContain("[1]");
  });
});
