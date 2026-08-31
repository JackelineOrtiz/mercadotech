import { test as base, expect } from "@playwright/test";
import { LoginPage } from "@/e2e/pages/LoginPage";
import { BUYER1, SELLER1 } from "@/e2e/data/users";

// Playwright ya aísla cada test en su propio BrowserContext (cookies,
// localStorage) por defecto — "sesión por test, sin estado compartido
// entre specs" es gratis, no hace falta storageState ni limpieza manual.
// Esta extensión solo agrega el login VÍA PAGE OBJECT como fixtures, para
// que cada spec de flujo (6.5/6.6) no repita las 4 líneas de LoginPage.login().
interface Fixtures {
  loginPage: LoginPage;
  loginAsBuyer: () => Promise<void>;
  loginAsSeller: () => Promise<void>;
}

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  loginAsBuyer: async ({ loginPage }, use) => {
    await use(() => loginPage.login(BUYER1));
  },
  loginAsSeller: async ({ loginPage }, use) => {
    await use(() => loginPage.login(SELLER1));
  },
});

export { expect };
