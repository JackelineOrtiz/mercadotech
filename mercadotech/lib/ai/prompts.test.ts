import { describe, it, expect } from "vitest";
import {
  buildRagUserMessage,
  SHOPPING_SYSTEM_INSTRUCTIONS,
  SUPPORT_SYSTEM_INSTRUCTIONS,
} from "@/lib/ai/prompts";

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

// Fase 7.5, hallazgo real de un subagente de auditoría (18 hilos con
// réplicas): el modelo dijo "no encontré control inalámbrico para PS5"
// cuando la fuente [4] de esa misma respuesta era exactamente ese
// producto, e inventó dos productos que MercadoTech no vende en vez de
// admitir el error. SUPPORT_SYSTEM_INSTRUCTIONS ya tenía una regla
// equivalente ("revisá si algún artículo... antes de decir que no tenés
// la respuesta") — a SHOPPING_SYSTEM_INSTRUCTIONS le faltaba.
describe("SHOPPING_SYSTEM_INSTRUCTIONS", () => {
  it("incluye la instrucción de revisar TODAS las fuentes antes de decir que no encontró algo", () => {
    expect(SHOPPING_SYSTEM_INSTRUCTIONS).toContain("revisá TODAS las fuentes");
  });
});

// Fase 7.5, hallazgo real de un subagente de auditoría (segunda ronda,
// retomando el audit tras renovar el token de Hugging Face): el modelo
// de soporte inventó rutas de navegación de UI plausibles pero
// inexistentes ("Ayuda → Soporte → Abrir un ticket", cambiar contraseña
// desde "Mi perfil") que ningún artículo de la FAQ describe, y en un
// turno distinto generalizó una condición ("si sos vendedor") a un caso
// donde no aplicaba (un comprador).
describe("SUPPORT_SYSTEM_INSTRUCTIONS — hallazgos de la segunda ronda del audit", () => {
  it("incluye la instrucción de no inventar rutas de navegación de UI no escritas literalmente en el artículo", () => {
    expect(SUPPORT_SYSTEM_INSTRUCTIONS).toContain("ruta de navegación");
  });

  it("incluye la instrucción de respetar literalmente las condiciones/excepciones de un artículo, sin generalizarlas", () => {
    expect(SUPPORT_SYSTEM_INSTRUCTIONS).toContain("condición o excepción");
  });

  // Mismo audit, tercer hallazgo: preguntado el costo de envío con el
  // artículo completo (montos y plazos exactos) en el contexto, respondió
  // "consultá el artículo [5]" en vez de citar los montos que ya tenía —
  // deflectó en vez de responder, sin llegar a decir "no sé" (por eso la
  // regla de "revisá antes de rendirte", que ya existía, no lo evitó).
  it("incluye la instrucción de responder con el dato en vez de remitir al usuario a leer la fuente él mismo", () => {
    expect(SUPPORT_SYSTEM_INSTRUCTIONS).toContain("consultá el artículo");
  });
});
