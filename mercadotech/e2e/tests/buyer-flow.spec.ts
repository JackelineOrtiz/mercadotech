import { test, expect } from "@/e2e/fixtures/test";
import { CatalogPage } from "@/e2e/pages/CatalogPage";
import { ProductPage } from "@/e2e/pages/ProductPage";
import { CartPage } from "@/e2e/pages/CartPage";
import { OrdersPage } from "@/e2e/pages/OrdersPage";
import { LoginPage } from "@/e2e/pages/LoginPage";
import { LAPTOP_WITH_STOCK, OTHER_LAPTOP, CATEGORY_LAPTOPS } from "@/e2e/data/products";

// [RAZONAMIENTO] paso → consecuencia observable → testid/URL que la prueba:
//
// 1. login buyer1                    → catálogo con su menú de usuario   → testid user-menu visible
// 2. filtra "Laptops"                → el grid SOLO muestra laptops     → URL /categoria/laptops;
//                                                                          2 product-card, los títulos
//                                                                          exactos de las 2 laptops activas
// 3. abre un producto CON stock      → galería + precio visibles         → URL /producto/{id}; role
//                                                                          img con el título; testid
//                                                                          product-price con el monto real
// 4. agrega 2 unidades                → contador del navbar = 2           → testid cart-count = "2"
// 5. carrito → subtotal → checkout   → subtotal correcto, redirige       → testid cart-subtotal con el
//                                                                          monto real (2 × precio)
// 6. detalle del pedido               → pendiente, ítems SNAPSHOT         → URL /pedidos/{id}; testid
//                                                                          order-status = "Pendiente";
//                                                                          fila de order-items-table con
//                                                                          título/cantidad/subtotal reales
// 7. "Mis pedidos"                    → lista ESE pedido (por id)         → testid order-card con el
//                                                                          href exacto /pedidos/{id} —
//                                                                          nunca "el primero de la lista"
// 8. logout                           → navbar anónimo                   → link accesible "Ingresar"
//
// Precios verificados empíricamente con Intl.NumberFormat("es-PE", {style:
// "currency", currency:"PEN"}) antes de escribir las aserciones (el mismo
// formatter real de lib/utils.ts formatPrice) — "S/" y el monto van
// separados por U+00A0 (espacio de no separación), no un espacio normal.

test("flujo completo del comprador: login, filtrar, comprar y ver el pedido", async ({
  page,
  loginAsBuyer,
}) => {
  const catalog = new CatalogPage(page);
  const product = new ProductPage(page);
  const cart = new CartPage(page);
  const orders = new OrdersPage(page);
  const login = new LoginPage(page);

  await test.step("1. login buyer1 → catálogo con su menú de usuario", async () => {
    await loginAsBuyer();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("user-menu")).toBeVisible();
  });

  await test.step('2. filtra "Laptops" → el grid solo muestra laptops', async () => {
    await catalog.filterByCategory(CATEGORY_LAPTOPS.name);
    await expect(page).toHaveURL(`/categoria/${CATEGORY_LAPTOPS.slug}`);
    await expect(catalog.productCards()).toHaveCount(2);
    await expect(
      catalog.productCards().filter({ hasText: LAPTOP_WITH_STOCK.title }),
    ).toBeVisible();
    await expect(catalog.productCards().filter({ hasText: OTHER_LAPTOP.title })).toBeVisible();
  });

  await test.step("3. abre un producto con stock → galería, precio", async () => {
    await catalog.openProduct(LAPTOP_WITH_STOCK.title);
    await expect(page).toHaveURL(`/producto/${LAPTOP_WITH_STOCK.id}`);
    await expect(product.gallery(LAPTOP_WITH_STOCK.title)).toBeVisible();
    await expect(product.price()).toHaveText("S/ 2,199.00");
  });

  await test.step("4. agrega 2 unidades → contador del navbar = 2", async () => {
    await product.addToCart(2);
    await expect(catalog.cartCountBadge()).toHaveText("2");
  });

  let orderId = "";
  await test.step('5. carrito → subtotal correcto → "Finalizar compra"', async () => {
    await cart.goto();
    await expect(cart.subtotal()).toHaveText("S/ 4,398.00");
    orderId = await cart.checkout();
  });

  await test.step("6. redirige a /pedidos/[id] → pendiente, ítems snapshot", async () => {
    await expect(page).toHaveURL(`/pedidos/${orderId}`);
    await expect(orders.status()).toHaveText("Pendiente");

    const row = orders.itemsTable().locator("tr", { hasText: LAPTOP_WITH_STOCK.title });
    await expect(row.getByRole("cell").nth(2)).toHaveText("2"); // Cantidad
    await expect(row.getByRole("cell").nth(3)).toHaveText("S/ 4,398.00"); // Subtotal de la fila
    await expect(orders.total()).toHaveText("S/ 4,398.00");
  });

  await test.step('7. "Mis pedidos" lista ese pedido (por id)', async () => {
    await orders.goto();
    await expect(orders.orderCard(orderId)).toBeVisible();
  });

  await test.step("8. logout → navbar anónimo", async () => {
    await login.logout();
    // role="button", no "link" — ver el comentario de LoginPage.logout().
    await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
  });
});
