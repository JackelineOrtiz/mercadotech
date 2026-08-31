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
  // Hallazgo real #2 (primera versión de este método, ver historial): medir
  // boundingBox() propio y esperar contención completa funcionaba en local
  // (macOS, Chromium de escritorio) pero fallaba consistentemente en el
  // runner de GitHub Actions (ubuntu-latest, misma versión de Playwright/
  // Chromium) — reproducido con supabase/setup-cli en el mismo job y
  // confirmado con el trace real descargado del run fallido: las 60
  // pulsaciones de ArrowRight SÍ se dispararon, pero la tarjeta nunca
  // cumplía mi condición de "contención completa" ahí. En vez de seguir
  // ajustando geometría a ciegas por entorno, se usa la propia fuente de
  // verdad de dnd-kit: @dnd-kit/accessibility renderiza una región
  // role="status" aria-live="assertive" (parte de su contrato PÚBLICO de
  // accesibilidad, vía Announcements — a diferencia de un id autogenerado
  // como "DndLiveRegion-0", que es un detalle interno) que anuncia
  // "...was moved over droppable area {id}." cada vez que SU PROPIA
  // colisión (rectIntersection) cambia de droppable — pollear ese texto es
  // exactamente lo que dnd-kit decidió, sin reconstruir su geometría ni
  // depender de cómo cada entorno de CI renderiza/mide. No colisiona con
  // la región de sonner (Toaster), que usa aria-live="polite", no
  // "assertive" — verificado en node_modules/sonner antes de confiar en
  // el selector.
  private async pressUntilOverColumn(
    orderId: string,
    toStatus: OrderStatus,
    key: "ArrowRight" | "ArrowLeft",
  ) {
    const card = this.card(orderId);
    const liveRegion = this.page.locator('[role="status"][aria-live="assertive"]');
    await card.focus();
    await this.page.keyboard.press("Space");

    const MAX_PRESSES = 60; // ~60 × 25px (default de dnd-kit) = 1500px, de sobra para cruzar cualquier columna real
    let reached = false;
    for (let i = 0; i < MAX_PRESSES; i++) {
      const announcement = (await liveRegion.textContent().catch(() => null)) ?? "";
      if (announcement.includes(`droppable area ${toStatus}`)) {
        reached = true;
        break;
      }
      await this.page.keyboard.press(key);
    }

    // Code review de la Fase 6.6: sin esto, agotar MAX_PRESSES soltaba la
    // tarjeta donde fuera igual, en silencio — un fallo futuro se habría
    // visto como un toBeVisible() genérico más abajo en el spec, sin
    // señalar la causa real. Explícito acá para que el error apunte al
    // lugar correcto.
    if (!reached) {
      await this.page.keyboard.press("Escape"); // cancela el drag, no lo suelta a ciegas
      throw new Error(
        `El drag por teclado de la tarjeta ${orderId} no alcanzó la columna "${toStatus}" tras ${MAX_PRESSES} pulsaciones de ${key} (según el anuncio aria-live de dnd-kit).`,
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
