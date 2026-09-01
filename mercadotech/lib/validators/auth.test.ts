import { describe, it, expect } from "vitest";
import {
  validateLogin,
  validateRegister,
  validateUpdateProfile,
  validateChangePassword,
} from "@/lib/validators/auth";

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

describe("validateUpdateProfile", () => {
  it("caso feliz: nombre válido, teléfono vacío (opcional)", () => {
    expect(validateUpdateProfile({ displayName: "Ana", phone: "" })).toEqual({});
  });

  it("caso feliz: teléfono con dígitos suficientes", () => {
    expect(validateUpdateProfile({ displayName: "Ana", phone: "+51 987 654 321" })).toEqual({});
  });

  it("displayName por debajo del mínimo (1 carácter)", () => {
    expect(validateUpdateProfile({ displayName: "a", phone: "" }).displayName).toBeDefined();
  });

  it("displayName vacío (tras trim)", () => {
    expect(validateUpdateProfile({ displayName: "   ", phone: "" }).displayName).toBeDefined();
  });

  it("displayName por encima del máximo (61 caracteres)", () => {
    expect(
      validateUpdateProfile({ displayName: "a".repeat(61), phone: "" }).displayName,
    ).toBeDefined();
  });

  it("displayName en los dos bordes válidos (2 y 60) no genera error", () => {
    expect(validateUpdateProfile({ displayName: "aa", phone: "" }).displayName).toBeUndefined();
    expect(
      validateUpdateProfile({ displayName: "a".repeat(60), phone: "" }).displayName,
    ).toBeUndefined();
  });

  it("teléfono con menos de 6 dígitos: error", () => {
    expect(validateUpdateProfile({ displayName: "Ana", phone: "12345" }).phone).toBeDefined();
  });

  it("teléfono de solo espacios (tras trim, vacío): no es error — rama corta-circuito del &&", () => {
    expect(validateUpdateProfile({ displayName: "Ana", phone: "   " }).phone).toBeUndefined();
  });

  it("teléfono con exactamente 6 dígitos: válido (borde)", () => {
    expect(validateUpdateProfile({ displayName: "Ana", phone: "123456" }).phone).toBeUndefined();
  });
});

describe("validateChangePassword", () => {
  const ok = { currentPassword: "actual123", password: "12345678", confirmPassword: "12345678" };

  it("caso feliz: sin errores", () => {
    expect(validateChangePassword(ok)).toEqual({});
  });

  it("currentPassword vacía: error propio, aunque password/confirmPassword sean válidas", () => {
    const errors = validateChangePassword({ ...ok, currentPassword: "" });
    expect(errors.currentPassword).toBeDefined();
    expect(errors.password).toBeUndefined();
  });

  it("hereda las reglas de validateNewPassword para password/confirmPassword", () => {
    expect(validateChangePassword({ ...ok, password: "1234567" }).password).toBeDefined();
    expect(validateChangePassword({ ...ok, confirmPassword: "otra" }).confirmPassword).toBeDefined();
  });
});
