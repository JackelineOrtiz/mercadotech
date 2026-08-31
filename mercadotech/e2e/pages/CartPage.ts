import type { Page } from "@playwright/test";

export class CartPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/carrito");
  }

  subtotal() {
    return this.page.getByTestId("cart-subtotal");
  }

  checkoutButton() {
    return this.page.getByTestId("cart-checkout");
  }

  // Devuelve el id del pedido recién creado, leído de la URL de
  // redirección — NUNCA "el primero de la lista" (decisión de la spec de
  // la Fase 6.5: las aserciones se anclan al pedido que este checkout
  // realmente creó, no a una posición en /pedidos).
  async checkout(): Promise<string> {
    await this.checkoutButton().click();
    await this.page.waitForURL(/\/pedidos\/[0-9a-fA-F-]+$/);
    const match = this.page.url().match(/\/pedidos\/([0-9a-fA-F-]+)$/);
    if (!match) throw new Error(`No se pudo leer el id del pedido de la URL: ${this.page.url()}`);
    return match[1];
  }
}
