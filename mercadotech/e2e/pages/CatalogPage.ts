import type { Page } from "@playwright/test";

export class CatalogPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/");
  }

  async gotoCategory(slug: string) {
    await this.page.goto(`/categoria/${slug}`);
  }

  grid() {
    return this.page.getByTestId("product-grid");
  }

  productCards() {
    return this.page.getByTestId("product-card");
  }

  // Recorre el menú "Categorías" del Navbar (visible en cualquier pantalla
  // de (shop)) — selector por rol accesible, sin data-testid: el trigger ya
  // tiene nombre accesible por su propio texto ("Categorías") y cada item
  // del dropdown es un <Link> con el nombre real de la categoría.
  async filterByCategory(name: string) {
    await this.page.getByRole("button", { name: "Categorías" }).click();
    await this.page.getByRole("menuitem", { name }).click();
  }

  async openProduct(title: string) {
    await this.productCards().filter({ hasText: title }).first().click();
  }

  cartCountBadge() {
    return this.page.getByTestId("cart-count");
  }
}
