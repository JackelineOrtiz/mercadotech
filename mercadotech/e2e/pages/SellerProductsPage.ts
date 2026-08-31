import type { Page } from "@playwright/test";

export interface PublishProductInput {
  title: string;
  description: string;
  brand: string;
  price: string;
  stock: string;
  category: string;
  condition: "Nuevo" | "Usado" | "Reacondicionado";
  imagePath: string;
}

export class SellerProductsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/vendedor/productos");
  }

  async gotoPublish() {
    await this.page.goto("/vendedor/publicar");
  }

  // Una fila por producto — se ubica por su título (repetido en cada fila,
  // .filter() lo angosta a la fila real) en vez de por id: la tabla no
  // conoce el id del producto recién publicado hasta después de crearlo.
  row(title: string) {
    return this.page.getByTestId("seller-product-row").filter({ hasText: title });
  }

  async publish(input: PublishProductInput) {
    await this.gotoPublish();
    await this.page.getByTestId("product-form-title").fill(input.title);
    await this.page.getByTestId("product-form-description").fill(input.description);
    await this.page.getByTestId("product-form-brand").fill(input.brand);

    await this.page.getByTestId("product-form-condition").click();
    await this.page.getByRole("option", { name: input.condition }).click();

    await this.page.getByTestId("product-form-price").fill(input.price);
    await this.page.getByTestId("product-form-stock").fill(input.stock);

    await this.page.getByTestId("product-form-category").click();
    await this.page.getByRole("option", { name: input.category }).click();

    // setInputFiles apunta directo al <input type="file"> sr-only — no
    // hace falta simular el click en el botón "Agregar" que lo dispara.
    await this.page.getByTestId("product-form-images-input").setInputFiles(input.imagePath);

    await this.page.getByTestId("product-form-submit").click();
  }
}
