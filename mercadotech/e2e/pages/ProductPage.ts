import type { Page } from "@playwright/test";

export class ProductPage {
  constructor(private page: Page) {}

  async goto(productId: string) {
    await this.page.goto(`/producto/${productId}`);
  }

  // ProductGallery no tiene testid propio: la imagen (real o el placeholder
  // de ProductImage cuando falla/no existe) SIEMPRE lleva role="img" con el
  // título del producto como nombre accesible — alcanza sin agregar nada.
  gallery(productTitle: string) {
    return this.page.getByRole("img", { name: productTitle });
  }

  price() {
    return this.page.getByTestId("product-price");
  }

  quantitySelect() {
    return this.page.getByTestId("buybox-quantity");
  }

  addToCartButton() {
    return this.page.getByTestId("buybox-add-to-cart");
  }

  // El motivo (sin stock, sin sesión, es tu propio producto...) — visible
  // como texto o como botón de login según el caso, ambos con el mismo
  // testid (BuyBox.tsx: son alternativas mutuamente excluyentes del mismo rol).
  disabledReason() {
    return this.page.getByTestId("buybox-disabled-reason");
  }

  async addToCart(quantity: number) {
    await this.quantitySelect().selectOption(String(quantity));
    await this.addToCartButton().click();
  }
}
