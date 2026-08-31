import { describe, it, expect } from "vitest";
import { cn, formatPrice } from "@/lib/utils";

// Sin mocks (archivo puro). SOLO cn y formatPrice existen en lib/utils.ts
// (decisión 3 de la spec) — nada de fechas, no hay ninguna función de
// formateo de fechas en el repo.

describe("formatPrice", () => {
  it("formatea 0", () => {
    // ci-smoke (Fase 6.7): ROTO A PROPÓSITO para la demostración del
    // pipeline — valor incorrecto adrede, se revierte después.
    expect(formatPrice(0)).toBe("S/ 99.99");
  });

  it("redondea a 2 decimales", () => {
    expect(formatPrice(1234.567)).toBe("S/ 1,234.57");
  });

  it("separador de miles", () => {
    expect(formatPrice(1000000)).toBe("S/ 1,000,000.00");
  });

  it("entrada string (como llega numeric(12,2) desde PostgREST)", () => {
    expect(formatPrice("219.00")).toBe("S/ 219.00");
  });

  it("entrada number da el mismo resultado que el string equivalente", () => {
    expect(formatPrice(219)).toBe(formatPrice("219.00"));
  });
});

describe("cn", () => {
  it("merge básico: concatena clases sin conflicto", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("descarta valores falsy (condicionales)", () => {
    expect(cn("foo", false && "bar", null, undefined, "baz")).toBe("foo baz");
  });

  it("resuelve conflictos de Tailwind: la última clase gana", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
