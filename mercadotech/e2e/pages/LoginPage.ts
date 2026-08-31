import type { Page } from "@playwright/test";
import type { TestUser } from "@/e2e/data/users";

export class LoginPage {
  constructor(private page: Page) {}

  async goto(redirectTo?: string) {
    await this.page.goto(redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : "/login");
  }

  async login(user: TestUser) {
    await this.goto();
    await this.page.getByTestId("login-email").fill(user.email);
    await this.page.getByTestId("login-password").fill(user.password);
    await this.page.getByTestId("login-submit").click();
    await this.page.getByTestId("user-menu").waitFor();
  }

  // Disponible en cualquier pantalla de (shop) — el Navbar (con user-menu)
  // es global a ese layout, así que no hace falta un método por página.
  async logout() {
    await this.page.getByTestId("user-menu").click();
    await this.page.getByTestId("user-menu-logout").click();
    await this.page.getByRole("link", { name: "Ingresar" }).waitFor();
  }
}
