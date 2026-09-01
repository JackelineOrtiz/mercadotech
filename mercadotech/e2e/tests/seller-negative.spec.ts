import { test, expect } from "@/e2e/fixtures/test";
import { SellerKanbanPage } from "@/e2e/pages/SellerKanbanPage";
import { LoginPage } from "@/e2e/pages/LoginPage";
import { SELLER1 } from "@/e2e/data/users";
import { ORDER_ENVIADO_SELLER1 } from "@/e2e/data/orders";

// [RAZONAMIENTO]
// - buyer1 en /vendedor/productos: el middleware solo bloquea anónimos
//   (middleware.ts) — un comprador CON sesión SÍ llega a la
//   ruta a nivel HTTP. El guard real vive en el cliente
//   (app/(seller)/layout.tsx): cuando profile.role no es seller/admin,
//   muestra toast.error("Necesitas una cuenta de vendedor") y redirige a
//   "/" — eso es lo que se verifica, no un 403 del servidor.
// - Retroceder 'enviado' → 'pagado': useSellerOrders.canMove lo rechaza
//   ANTES de llamar al service (RLS de hecho lo permitiría — ver el
//   comentario de useSellerOrders.ts) con un toast.error nombrando ambos
//   estados. La tarjeta no debe moverse de columna: se verifica que sigue
//   en 'enviado' tanto en el DOM como (para no confiar solo en un
//   render que nunca llegó a empezar) tras page.reload().

test("buyer1 no puede acceder al panel de vendedor: redirect + toast", async ({
  page,
  loginAsBuyer,
}) => {
  await loginAsBuyer();
  await page.goto("/vendedor/productos");

  await expect(page.getByText("Necesitas una cuenta de vendedor")).toBeVisible();
  await expect(page).toHaveURL("/");
});

test("retroceder 'enviado' → 'pagado': la UI lo rechaza y la tarjeta no se mueve", async ({
  page,
}) => {
  const login = new LoginPage(page);
  const kanban = new SellerKanbanPage(page);

  await login.login(SELLER1);
  await kanban.goto();
  await expect(kanban.cardInColumn(ORDER_ENVIADO_SELLER1.id, "enviado")).toBeVisible();

  await kanban.attemptMoveBackward(ORDER_ENVIADO_SELLER1.id, "pagado");

  await expect(
    page.getByText('No puedes mover un pedido de "Enviado" directo a "Pagado".'),
  ).toBeVisible();
  // La tarjeta sigue en 'enviado' — ni en el DOM inmediato...
  await expect(kanban.cardInColumn(ORDER_ENVIADO_SELLER1.id, "enviado")).toBeVisible();
  await expect(kanban.cardInColumn(ORDER_ENVIADO_SELLER1.id, "pagado")).toHaveCount(0);

  // ...ni después de recargar (mismo criterio que el paso 4 de
  // seller-flow.spec.ts: un reload prueba el estado real de Postgres).
  await page.reload();
  await expect(kanban.cardInColumn(ORDER_ENVIADO_SELLER1.id, "enviado")).toBeVisible();
});
