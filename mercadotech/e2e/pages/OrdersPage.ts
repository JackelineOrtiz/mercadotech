import type { Page } from "@playwright/test";

export class OrdersPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/pedidos");
  }

  async gotoDetail(orderId: string) {
    await this.page.goto(`/pedidos/${orderId}`);
  }

  // Localiza la tarjeta por su href real (/pedidos/{id}), no por posición
  // en la lista — mismo criterio "nunca el primero de la lista" que
  // CartPage.checkout().
  orderCard(orderId: string) {
    return this.page.locator(`[data-testid="order-card"][href="/pedidos/${orderId}"]`);
  }

  status() {
    return this.page.getByTestId("order-status");
  }

  itemsTable() {
    return this.page.getByTestId("order-items-table");
  }

  total() {
    return this.page.getByTestId("order-total");
  }

  cancelButton() {
    return this.page.getByTestId("order-cancel");
  }
}
