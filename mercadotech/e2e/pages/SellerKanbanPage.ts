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

  // Confirma que la tarjeta está DENTRO de una columna específica (no solo
  // "existe en algún lado") — necesario para verificar que un movimiento
  // realmente cambió de columna, no que la tarjeta sigue donde estaba.
  cardInColumn(orderId: string, status: OrderStatus) {
    return this.column(status).getByTestId(`kanban-card-${orderId}`);
  }

  // Camino de TECLADO de dnd-kit (decisión 9 de la spec: el drag con mouse
  // es frágil bajo Playwright, y el KeyboardSensor ya está activo desde la
  // Sesión 3): focus en la tarjeta (el propio div es el "asa", lleva los
  // listeners de dnd-kit) → Space activa el drag → repetir la flecha →
  // Space suelta.
  //
  // Hallazgo real #1 (Fase 6.6): dnd-kit, SIN un coordinateGetter propio en
  // OrdersKanban.tsx (usa el default de @dnd-kit/core), mueve el cursor
  // virtual 25px por pulsación — NO "una columna por pulsación", que es lo
  // que el ejemplo de la spec asumía. No es un problema de accesibilidad
  // (el camino de teclado SÍ funciona, tal como documenta la bitácora de
  // la Sesión 3): solo hace falta más de una pulsación para cruzar una
  // columna.
  //
  // Hallazgo real #2: no basta con que el CENTRO de la tarjeta cruce al
  // lado de la columna destino — DndContext usa rectIntersection (default
  // de @dnd-kit/core, sin collisionDetection propio en OrdersKanban.tsx),
  // que compara ÁREA de solapamiento, no un punto. Con el centro apenas
  // cruzado, la mayor parte de la tarjeta seguía en la columna de origen,
  // así que rectIntersection igual elegía esa como destino (confirmado
  // empíricamente: el drop terminaba en la columna de partida). Se espera
  // a que la tarjeta esté COMPLETAMENTE contenida en la columna destino
  // (su borde de avance ya cruzó el borde correspondiente de la columna
  // destino) — ahí el solapamiento es total, sin ambigüedad posible.
  private async pressUntilOverColumn(
    orderId: string,
    toStatus: OrderStatus,
    key: "ArrowRight" | "ArrowLeft",
  ) {
    const card = this.card(orderId);
    const targetColumn = this.column(toStatus);
    await card.focus();
    await this.page.keyboard.press("Space");

    const MAX_PRESSES = 60; // ~60 × 25px = 1500px, de sobra para cruzar cualquier columna real
    let reached = false;
    for (let i = 0; i < MAX_PRESSES; i++) {
      const [cardBox, targetBox] = await Promise.all([card.boundingBox(), targetColumn.boundingBox()]);
      if (cardBox && targetBox) {
        const fullyContained =
          key === "ArrowRight"
            ? cardBox.x >= targetBox.x
            : cardBox.x + cardBox.width <= targetBox.x + targetBox.width;
        if (fullyContained) {
          reached = true;
          break;
        }
      }
      await this.page.keyboard.press(key);
    }

    // Code review de la Fase 6.6: sin esto, agotar MAX_PRESSES soltaba la
    // tarjeta donde fuera igual, en silencio — un fallo futuro (ej. un
    // cambio de layout que agrande las columnas) se habría visto como un
    // toBeVisible() genérico más abajo en el spec, sin señalar la causa
    // real. Explícito acá para que el error apunte al lugar correcto.
    if (!reached) {
      await this.page.keyboard.press("Escape"); // cancela el drag, no lo suelta a ciegas
      throw new Error(
        `El drag por teclado de la tarjeta ${orderId} no alcanzó la columna "${toStatus}" tras ${MAX_PRESSES} pulsaciones de ${key}.`,
      );
    }

    await this.page.keyboard.press("Space");
  }

  async moveOrderForward(orderId: string, toStatus: OrderStatus) {
    await this.pressUntilOverColumn(orderId, toStatus, "ArrowRight");
  }

  // Mismo camino de teclado, en la dirección opuesta — para probar que
  // useSellerOrders.canMove rechaza retroceder (Fase 6.6, seller-negative).
  async attemptMoveBackward(orderId: string, toStatus: OrderStatus) {
    await this.pressUntilOverColumn(orderId, toStatus, "ArrowLeft");
  }
}
