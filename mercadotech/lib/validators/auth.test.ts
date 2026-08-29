import { describe, it, expect } from "vitest";
import { validateLogin, validateRegister } from "@/lib/validators/auth";

// Sin mocks (archivo puro). Los valores límite de displayName (2/60) y de
// password (8) están HARDCODEADOS en auth.ts, sin constante exportada que
// importar (a diferencia de lib/constants/product.ts para el producto) —
// se anotan como números literales con el comentario del porqué en vez de
// una constante inexistente. Ver duda anotada en el Prompt 1 de esta sesión.

describe("validateLogin", () => {
  it("caso feliz: sin errores", () => {
    expect(validateLogin({ email: "a@b.com", password: "cualquiera" })).toEqual({});
  });

  it("email vacío", () => {
    const errors = validateLogin({ email: "", password: "x" });
    expect(errors.email).toBeDefined();
  });

  it("email con formato inválido", () => {
    const errors = validateLogin({ email: "no-es-un-correo", password: "x" });
    expect(errors.email).toBeDefined();
  });

  it("password vacío", () => {
    const errors = validateLogin({ email: "a@b.com", password: "" });
    expect(errors.password).toBeDefined();
  });
});

describe("validateRegister", () => {
  const ok = { displayName: "Jackie", email: "a@b.com", password: "12345678", role: "buyer" as const };

  it("caso feliz: sin errores", () => {
    expect(validateRegister(ok)).toEqual({});
  });

  it("displayName por debajo del mínimo (1 carácter)", () => {
    const errors = validateRegister({ ...ok, displayName: "a" });
    expect(errors.displayName).toBeDefined();
  });

  it("displayName vacío (tras trim)", () => {
    const errors = validateRegister({ ...ok, displayName: "   " });
    expect(errors.displayName).toBeDefined();
  });

  it("displayName por encima del máximo (61 caracteres)", () => {
    const errors = validateRegister({ ...ok, displayName: "a".repeat(61) });
    expect(errors.displayName).toBeDefined();
  });

  it("displayName en los dos bordes válidos (2 y 60) no genera error", () => {
    expect(validateRegister({ ...ok, displayName: "aa" }).displayName).toBeUndefined();
    expect(validateRegister({ ...ok, displayName: "a".repeat(60) }).displayName).toBeUndefined();
  });

  it("email vacío", () => {
    const errors = validateRegister({ ...ok, email: "" });
    expect(errors.email).toBeDefined();
  });

  it("email no vacío pero con formato inválido (rama else-if)", () => {
    const errors = validateRegister({ ...ok, email: "no-es-un-correo" });
    expect(errors.email).toBeDefined();
  });

  it("rechaza password de 7 y acepta de 8", () => {
    expect(validateRegister({ ...ok, password: "1234567" }).password).toBeDefined();
    expect(validateRegister({ ...ok, password: "12345678" }).password).toBeUndefined();
  });

  it("rol admin rechazado — no es un rol registrable por este formulario", () => {
    // No existe REGISTRABLE_ROLES ni isUserRole en el código real (Prompt 1):
    // el rechazo está inline (`role !== "buyer" && role !== "seller"`).
    const errors = validateRegister({ ...ok, role: "admin" as never });
    expect(errors.role).toBeDefined();
  });

  it("rol seller es válido (rama corta-circuito del && en false)", () => {
    expect(validateRegister({ ...ok, role: "seller" }).role).toBeUndefined();
  });
});
