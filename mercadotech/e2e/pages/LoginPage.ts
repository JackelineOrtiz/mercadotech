import type { Page } from "@playwright/test";
import type { TestUser } from "@/e2e/data/users";

export class LoginPage {
  constructor(private page: Page) {}

  async goto(redirectTo?: string) {
    const url = redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : "/login";

    // Hallazgo real, solo en WebKit: cuando este goto sigue a un logout
    // (seller-flow paso 5), el handler de app/(shop)/layout.tsx todavía
    // tiene un router.push("/") + router.refresh() en vuelo — logout()
    // espera a que el Navbar muestre "Ingresar", que ocurre en cuanto
    // useAuth recarga el perfil vacío, ANTES de que esa redirección
    // termine. WebKit aborta el goto con "interrupted by another
    // navigation to .../"; Chromium y Firefox absorben la carrera. Un
    // segundo intento, ya con el push del logout consumido, entra limpio.
    try {
      await this.page.goto(url);
    } catch (err) {
      if (err instanceof Error && err.message.includes("interrupted by another navigation")) {
        await this.page.goto(url);
        return;
      }
      throw err;
    }
  }

  async login(user: TestUser) {
    await this.goto();
    const email = this.page.getByTestId("login-email");
    const password = this.page.getByTestId("login-password");

    await email.fill(user.email);
    await password.fill(user.password);

    // Hallazgo real, solo en WebKit: LoginForm es un input CONTROLADO
    // (value={values.email} vía useState) dentro de un <Suspense> — si el
    // fill() de email corre justo antes de que React termine de hidratar
    // y enganchar su onChange, la hidratación pisa el DOM con el estado
    // inicial ("") y el input queda vacío aunque el fill() haya "tenido
    // éxito" a nivel de Playwright. Confirmado con el page snapshot de un
    // fallo real: password con el valor correcto, email vacío y el error
    // "Ingresa tu correo." visible. Se verifica y se rellena una vez más
    // si el valor no se sostuvo — para entonces la hidratación ya terminó.
    if ((await email.inputValue()) !== user.email) {
      await email.fill(user.email);
    }

    await this.page.getByTestId("login-submit").click();
    // Hallazgo real (Fase 7.5): esperar "user-menu" acá rompió en cuanto
    // el login empezó a redirigir por rol — un vendedor ahora aterriza en
    // /vendedor/productos, que usa SellerSidebar en vez del Navbar de
    // (shop)/, así que "user-menu" nunca aparece ahí y este wait colgaba
    // hasta el timeout. Esperar a que la URL deje /login es agnóstico del
    // destino real (buyer a "/", seller a /vendedor/productos, admin a
    // /admin) — refleja la condición real de éxito (se redirigió), no un
    // detalle de qué layout renderiza después.
    await this.page.waitForURL((url) => !url.pathname.startsWith("/login"));
  }

  // Disponible en cualquier pantalla de (shop) — el Navbar (con user-menu)
  // es global a ese layout, así que no hace falta un método por página.
  async logout() {
    await this.page.getByTestId("user-menu").click();
    await this.page.getByTestId("user-menu-logout").click();
    // "Ingresar" es un <Link> con nativeButton={false} (UserMenu.tsx) —
    // Base UI le da role="button" para exponer semántica de botón, no
    // role="link", aunque el tag real sea <a>. Confirmado con el snapshot
    // real de Playwright, no asumido.
    await this.page.getByRole("button", { name: "Ingresar" }).waitFor();
  }
}
