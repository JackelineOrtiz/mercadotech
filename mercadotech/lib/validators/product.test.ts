import { describe, it, expect } from "vitest";
import { validateProduct } from "@/lib/validators/product";
import { TITLE_MIN, TITLE_MAX } from "@/lib/constants/product";

// Sin mocks (archivo puro). Los valores límite salen de las constantes
// reales importadas — nunca copiados a mano.

describe("validateProduct", () => {
  const ok = {
    title: "Laptop Lenovo IdeaPad Slim 3",
    price: 2199,
    stock: 8,
    categoryId: "d0000000-0000-0000-0000-000000000001",
    imageCount: 3,
  };

  it("caso feliz: sin errores", () => {
    expect(validateProduct(ok)).toEqual({});
  });

  it("título por debajo de TITLE_MIN", () => {
    const errors = validateProduct({ ...ok, title: "a".repeat(TITLE_MIN - 1) });
    expect(errors.title).toBeDefined();
  });

  it("título por encima de TITLE_MAX", () => {
    const errors = validateProduct({ ...ok, title: "a".repeat(TITLE_MAX + 1) });
    expect(errors.title).toBeDefined();
  });

  it("título en los dos bordes válidos (TITLE_MIN y TITLE_MAX) no genera error", () => {
    expect(validateProduct({ ...ok, title: "a".repeat(TITLE_MIN) }).title).toBeUndefined();
    expect(validateProduct({ ...ok, title: "a".repeat(TITLE_MAX) }).title).toBeUndefined();
  });

  it("precio 0 → error por CAMPO price", () => {
    const errors = validateProduct({ ...ok, price: 0 });
    expect(errors.price).toBeDefined();
    expect(errors.title).toBeUndefined();
  });

  it("precio negativo → error por CAMPO price", () => {
    const errors = validateProduct({ ...ok, price: -10 });
    expect(errors.price).toBeDefined();
  });

  it("precio válido no genera error", () => {
    expect(validateProduct({ ...ok, price: 1 }).price).toBeUndefined();
  });

  it("stock no entero (rama 1 del OR) → error por CAMPO stock", () => {
    const errors = validateProduct({ ...ok, stock: 1.5 });
    expect(errors.stock).toBeDefined();
  });

  it("stock negativo pero entero (rama 2 del OR, la 1 ya en false) → error por CAMPO stock", () => {
    const errors = validateProduct({ ...ok, stock: -1 });
    expect(errors.stock).toBeDefined();
  });

  it("stock 0 es válido (entero y no negativo)", () => {
    expect(validateProduct({ ...ok, stock: 0 }).stock).toBeUndefined();
  });

  it("sin categoría → error por CAMPO categoryId", () => {
    const errors = validateProduct({ ...ok, categoryId: "" });
    expect(errors.categoryId).toBeDefined();
  });

  it("sin imágenes (imageCount 0) → error por CAMPO images", () => {
    const errors = validateProduct({ ...ok, imageCount: 0 });
    expect(errors.images).toBeDefined();
  });

  it("una sola imagen es válida (imageCount 1)", () => {
    expect(validateProduct({ ...ok, imageCount: 1 }).images).toBeUndefined();
  });
});
