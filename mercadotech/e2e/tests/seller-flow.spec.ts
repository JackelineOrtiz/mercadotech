import { test, expect } from "@/e2e/fixtures/test";
import { SellerProductsPage } from "@/e2e/pages/SellerProductsPage";
import { SellerKanbanPage } from "@/e2e/pages/SellerKanbanPage";
import { CatalogPage } from "@/e2e/pages/CatalogPage";
import { OrdersPage } from "@/e2e/pages/OrdersPage";
import { LoginPage } from "@/e2e/pages/LoginPage";
import { BUYER2, SELLER2 } from "@/e2e/data/users";
import { ORDER_PAGADO_SELLER2 } from "@/e2e/data/orders";

// [RAZONAMIENTO]
// (a) Qué pedido 'pagado' pertenece a qué vendedor (verificado leyendo
//     supabase/seed.sql, no asumido — ver e2e/data/orders.ts con el
//     detalle completo de los 6 pedidos): el ÚNICO pedido 'pagado' del
//     seed es c…003, cuyos 2 ítems son ambos de SELLER2, comprados por
//     BUYER2. seller1 no tiene ningún pedido 'pagado' — por eso este spec
//     usa seller2/buyer2, no seller1/buyer1 como en la Fase 6.5.
// (b) Por qué la persistencia se afirma con page.reload() y no solo por el
//     DOM: useSellerOrders.move() es una actualización OPTIMISTA — mueve
//     la tarjeta en el estado local de React ANTES de que la llamada a
//     updateOrderStatus() confirme nada, y solo revierte si esa llamada
//     falla. Si el rollback tuviera un bug (o el request nunca se
//     disparara), el DOM igual mostraría la tarjeta en la columna nueva.
//     page.reload() descarta todo el estado de React y fuerza a
//     useSellerOrders a re-consultar listMyOrders() desde cero contra
//     Postgres — solo entonces "la tarjeta sigue en 'enviado'" prueba que
//     el UPDATE quedó escrito de verdad, no que el navegador lo recuerda.

const NEW_PRODUCT_TITLE = `Producto E2E ${Date.now()}`;

test("flujo completo del vendedor: publicar producto y mover un pedido por teclado", async ({
  page,
}) => {
  const login = new LoginPage(page);
  const sellerProducts = new SellerProductsPage(page);
  const kanban = new SellerKanbanPage(page);
  const catalog = new CatalogPage(page);
  const orders = new OrdersPage(page);

  await test.step("1. login seller2 → panel", async () => {
    await login.login(SELLER2);
    await sellerProducts.goto();
    await expect(page.getByRole("heading", { name: "Mis productos" })).toBeVisible();
  });

  await test.step("2. publica un producto (título único por timestamp) con imagen", async () => {
    await sellerProducts.publish({
      title: NEW_PRODUCT_TITLE,
      description: "Producto creado por el E2E de la Fase 6.6.",
      brand: "E2E",
      price: "199.90",
      stock: "5",
      category: "Accesorios",
      condition: "Nuevo",
      imagePath: "e2e/data/product-image.jpg",
    });
  });

  await test.step("3. aparece en su tabla Y en el catálogo público", async () => {
    await sellerProducts.goto();
    await expect(sellerProducts.row(NEW_PRODUCT_TITLE)).toBeVisible();

    await catalog.goto();
    await expect(catalog.productCards().filter({ hasText: NEW_PRODUCT_TITLE })).toBeVisible();
  });

  await test.step("4. kanban: mueve el pedido 'pagado' a 'enviado' POR TECLADO y persiste tras reload", async () => {
    await kanban.goto();
    await expect(kanban.cardInColumn(ORDER_PAGADO_SELLER2.id, "pagado")).toBeVisible();

    // focus en el asa → Space (levanta) → ArrowRight (columna siguiente) →
    // Space (suelta) — patrón de KeyboardSensor, decisión 9 de la spec.
    await kanban.moveOrderForward(ORDER_PAGADO_SELLER2.id, "enviado");

    await expect(kanban.cardInColumn(ORDER_PAGADO_SELLER2.id, "enviado")).toBeVisible();

    await page.reload();
    await expect(kanban.cardInColumn(ORDER_PAGADO_SELLER2.id, "enviado")).toBeVisible();
  });

  await test.step("5. login como el comprador de ese pedido → su detalle muestra 'enviado'", async () => {
    // logout() necesita el Navbar (con user-menu), que solo existe en el
    // layout (shop) — venimos de /vendedor/pedidos, bajo (seller), que no
    // lo tiene (solo SellerSidebar). Se navega a home primero.
    await catalog.goto();
    await login.logout();
    await login.login(BUYER2);
    await orders.gotoDetail(ORDER_PAGADO_SELLER2.id);
    await expect(orders.status()).toHaveText("Enviado");
  });
});
