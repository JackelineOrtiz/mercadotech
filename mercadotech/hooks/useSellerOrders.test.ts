import { describe, it, expect } from "vitest";
import { canMove } from "@/hooks/useSellerOrders";

// canMove es un helper puro exportado en la Fase 6.3 solo para poder
// testearlo sin React (ver el comentario junto a su definición). Cubre las
// 3 transiciones inválidas documentadas ahí mismo, no solo el caso feliz.

describe("useSellerOrders.canMove", () => {
  it("permite un paso adelante en el flujo", () => {
    expect(canMove("pendiente", "pagado")).toBe(true);
    expect(canMove("pagado", "enviado")).toBe(true);
    expect(canMove("enviado", "entregado")).toBe(true);
  });

  it("rechaza saltarse pasos (pendiente → entregado)", () => {
    expect(canMove("pendiente", "entregado")).toBe(false);
  });

  it("rechaza retroceder (entregado → pagado)", () => {
    expect(canMove("entregado", "pagado")).toBe(false);
  });

  it("rechaza cualquier destino 'cancelado' (no está en ORDER_STATUS_FLOW)", () => {
    expect(canMove("pendiente", "cancelado")).toBe(false);
    expect(canMove("pagado", "cancelado")).toBe(false);
    expect(canMove("enviado", "cancelado")).toBe(false);
  });

  it("rechaza quedarse en el mismo estado", () => {
    expect(canMove("pagado", "pagado")).toBe(false);
  });

  it("un origen 'entregado' (último paso) no tiene siguiente: siempre false", () => {
    expect(canMove("entregado", "pendiente")).toBe(false);
    expect(canMove("entregado", "entregado")).toBe(false);
  });
});
