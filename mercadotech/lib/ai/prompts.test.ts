import { describe, it, expect } from "vitest";
import { buildRagUserMessage, SUPPORT_SYSTEM_INSTRUCTIONS } from "@/lib/ai/prompts";

// Sin mocks (archivo puro: solo arma strings, cero red).

describe("buildRagUserMessage", () => {
  it("con fuentes: contiene la query y las fuentes numeradas", () => {
    const message = buildRagUserMessage("laptop para diseño", [
      { index: 1, content: "Laptop HP Pavilion, Intel i5." },
      { index: 2, content: "Laptop Lenovo IdeaPad, Ryzen 5." },
    ]);

    expect(message).toContain("laptop para diseño");
    expect(message).toContain("[1] Laptop HP Pavilion, Intel i5.");
    expect(message).toContain("[2] Laptop Lenovo IdeaPad, Ryzen 5.");
  });

  it("sin fuentes: le dice explícitamente al modelo que no hay contexto", () => {
    const message = buildRagUserMessage("¿venden autos usados?", []);

    expect(message).toContain("¿venden autos usados?");
    expect(message).toContain("No se encontró información relevante");
  });
});

describe("SUPPORT_SYSTEM_INSTRUCTIONS", () => {
  it("incluye la instrucción de sugerir un ticket cuando no sabe la respuesta", () => {
    expect(SUPPORT_SYSTEM_INSTRUCTIONS).toContain("ticket");
  });
});
