import type { Page } from "@playwright/test";
import type { OrderStatus } from "@/lib/constants/roles";

export class SellerKanbanPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/vendedor/pedidos");
  }

  column(status: OrderStatus) {
    return this.page.getByTestId(`kanban-column-${status}`);
  }

  card(orderId: string) {
    return this.page.getByTestId(`kanban-card-${orderId}`);
  }

  // Camino de TECLADO de dnd-kit (decisión 9 de la spec: el drag con mouse
  // es frágil bajo Playwright, y el KeyboardSensor ya está activo desde la
  // Sesión 3): focus en la tarjeta (el propio div es el "asa", lleva los
  // listeners de dnd-kit) → Space activa el drag → ArrowRight avanza una
  // columna por pulsación → Space suelta. `steps` > 1 solo si algún test
  // necesita saltar más de una columna (no es el caso de "un paso
  // adelante", que es la única transición que useSellerOrders.canMove
  // permite de todos modos).
  async moveOrderForward(orderId: string, steps = 1) {
    const card = this.card(orderId);
    await card.focus();
    await this.page.keyboard.press("Space");
    for (let i = 0; i < steps; i++) {
      await this.page.keyboard.press("ArrowRight");
    }
    await this.page.keyboard.press("Space");
  }
}
