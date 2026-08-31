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

  // Devuelve el id del producto recién creado, leído de la URL de
  // redirección (VendedorPublicarPage navega a
  // /vendedor/productos/{id}/editar en éxito) — mismo criterio "nunca
  // adivinar el id" que CartPage.checkout()/OrdersPage.
  async publish(input: PublishProductInput): Promise<string> {
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
    await this.page.waitForURL(/\/vendedor\/productos\/[0-9a-fA-F-]+\/editar$/);
    const match = this.page.url().match(/\/vendedor\/productos\/([0-9a-fA-F-]+)\/editar$/);
    if (!match) throw new Error(`No se pudo leer el id del producto de la URL: ${this.page.url()}`);
    return match[1];
  }
}
