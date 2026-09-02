import { describe, it, expect } from "vitest";
import { cn, formatPrice, translateAuthError } from "@/lib/utils";

// Sin mocks (archivo puro). cn y formatPrice existen desde la decisión 3
// de la spec; translateAuthError se agregó en la Fase 7.5 (hallazgo real,
// ver su propio comentario en lib/utils.ts) — nada de fechas, no hay
// ninguna función de formateo de fechas en el repo.

describe("formatPrice", () => {
  it("formatea 0", () => {
    // Intl.NumberFormat("es-CO", {style:"currency", currency:"COP"}) separa
    // "$" del monto con un ESPACIO DE NO RUPTURA (U+00A0), no un espacio
    // normal (U+0020) — verificado real con Intl antes de escribir esta
    // aserción (generado con Node, no tipeado a mano, para no repetir el
    // error de la primera vez); escribirlo con espacio normal haría fallar
    // el test. Moneda colombiana real (Fase 7.5, pedido explícito): "."
    // separa miles, "," separa decimales — al revés que el es-PE/PEN
    // anterior.
    expect(formatPrice(0)).toBe("$ 0,00");
  });

  it("redondea a 2 decimales", () => {
    expect(formatPrice(1234.567)).toBe("$ 1.234,57");
  });

  it("separador de miles", () => {
    expect(formatPrice(1000000)).toBe("$ 1.000.000,00");
  });

  it("entrada string (como llega numeric(12,2) desde PostgREST)", () => {
    expect(formatPrice("219.00")).toBe("$ 219,00");
  });

  it("entrada number da el mismo resultado que el string equivalente", () => {
    expect(formatPrice(219)).toBe(formatPrice("219.00"));
  });
});

// Fase 7.5, hallazgo real de un usuario probando /login en producción:
// un intento real de login mostró literalmente "Failed to fetch" en la
// pantalla — el mensaje crudo de Supabase/del navegador, sin traducir.
describe("translateAuthError", () => {
  it("traduce 'Invalid login credentials'", () => {
    expect(translateAuthError("Invalid login credentials")).toBe(
      "Correo o contraseña incorrectos.",
    );
  });

  it("traduce 'Failed to fetch' (hallazgo real, error de red sin traducir)", () => {
    expect(translateAuthError("Failed to fetch")).toBe(
      "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.",
    );
  });

  it("un mensaje no mapeado se devuelve tal cual (mejor inglés real que un texto inventado)", () => {
    expect(translateAuthError("algo que Supabase nunca dijo")).toBe(
      "algo que Supabase nunca dijo",
    );
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
