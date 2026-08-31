import { test, expect } from "@/e2e/fixtures/test";
import { ProductPage } from "@/e2e/pages/ProductPage";
import { CartPage } from "@/e2e/pages/CartPage";
import { PRODUCT_OUT_OF_STOCK } from "@/e2e/data/products";

// [RAZONAMIENTO] paso → consecuencia observable → testid/URL:
// - producto con stock 0 (buyer1 logueado, no es el dueño) → botón
//   "Agregar al carrito" deshabilitado + motivo visible → testid
//   buybox-add-to-cart[disabled] + buybox-disabled-reason = "Sin stock"
//   (BuyBox.tsx: el orden real de motivos es !sesión > !activo > stock=0 >
//   dueño — con sesión y producto activo, "Sin stock" es el único posible).
// - /carrito vacío → SIN botón de checkout, EmptyState real (la UI real no
//   muestra un botón deshabilitado: carrito/page.tsx retorna un EmptyState
//   completo cuando items.length === 0 — se verifica el comportamiento
//   real, no lo que el prompt asumía) → testid cart-checkout AUSENTE
// - anónimo en /carrito → redirect real del middleware → URL
//   /login?redirectTo=%2Fcarrito

test("producto con stock 0: botón deshabilitado con motivo visible", async ({
  page,
  loginAsBuyer,
}) => {
  await loginAsBuyer();
  const product = new ProductPage(page);
  await product.goto(PRODUCT_OUT_OF_STOCK.id);

  await expect(product.addToCartButton()).toBeDisabled();
  await expect(product.disabledReason()).toHaveText("Sin stock");
});

test("carrito vacío: no hay forma de hacer checkout (EmptyState real)", async ({
  page,
  loginAsBuyer,
}) => {
  await loginAsBuyer();
  const cart = new CartPage(page);
  await cart.goto();

  // Comportamiento real verificado en app/(shop)/carrito/page.tsx: sin
  // ítems, la página retorna un EmptyState completo — no existe ningún
  // botón de checkout (ni habilitado ni deshabilitado) para clickear.
  await expect(cart.checkoutButton()).toHaveCount(0);
  await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
});

test("anónimo en /carrito: redirect a /login?redirectTo=/carrito", async ({ page }) => {
  await page.goto("/carrito");
  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fcarrito$/);
});
