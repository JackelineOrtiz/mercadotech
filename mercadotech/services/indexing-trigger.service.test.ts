import { describe, it, expect, vi, afterEach } from "vitest";
import { triggerReindex } from "@/services/indexing-trigger.service";

// Fire-and-forget: triggerReindex no es async y no devuelve nada (decisión
// explícita, ver el comentario del archivo) — la única forma de observar su
// comportamiento es espiar fetch/console.warn y esperar un tick de
// microtareas a que su .then()/.catch() interno corra.

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("indexing-trigger.service.triggerReindex", () => {
  it("hace POST a /api/v1/reindex con sourceType y sourceId", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    triggerReindex("producto", "p1");
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/reindex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType: "producto", sourceId: "p1" }),
    });
  });

  it("respuesta no ok: avisa con console.warn, sin lanzar (no rompe al vendedor)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => triggerReindex("articulo_soporte", "a1")).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(warnSpy).toHaveBeenCalledWith(
      "Reindexar articulo_soporte/a1 respondió 500.",
    );
  });

  it("fetch rechaza (red caída): avisa con console.warn, sin lanzar", async () => {
    const networkError = new Error("network down");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(networkError));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => triggerReindex("producto", "p1")).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(warnSpy).toHaveBeenCalledWith("No se pudo reindexar producto/p1:", networkError);
  });
});
