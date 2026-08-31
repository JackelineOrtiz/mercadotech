import { defineConfig, devices } from "@playwright/test";

// Requisito de entorno (Fase 6.4): estos E2E corren SIEMPRE contra Supabase
// LOCAL (`supabase start && supabase db reset`), nunca contra un proyecto
// remoto — el seed (buyer1/seller1, MercadoTech123!) y los productos con
// stock conocido (b...008 = 0) son parte del contrato de los specs.
//
// webServer (decisión 12 de la spec, patrón ReadHub): en CI no hay ningún
// servidor arriba, así que se construye y levanta el build de producción
// (paridad con lo que de verdad se despliega); en local se reutiliza
// `npm run dev` si ya está corriendo, para no perder el hot-reload del
// desarrollador mientras itera specs.
const CI = !!process.env.CI;
const PORT = 3000;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: true,
  // Un test con .only olvidado no debe poder pasar silenciosamente en CI.
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  // 1 worker en CI: el seed de Supabase es compartido entre todos los
  // specs de un mismo job — correr en paralelo ahí pisaría datos entre
  // tests (ej. dos specs moviendo el mismo pedido del kanban a la vez).
  workers: CI ? 1 : undefined,
  reporter: CI
    ? [["github"], ["html", { outputFolder: "e2e/playwright-report", open: "never" }]]
    : [["html", { outputFolder: "e2e/playwright-report", open: "never" }], ["list"]],
  outputDir: "e2e/test-results",

  use: {
    baseURL,
    // Solo en el reintento que sigue a un fallo — correr con trace/video
    // siempre ralentiza la suite sin aportar nada a los tests que ya pasan.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],

  webServer: {
    command: CI ? "npm run build && npm run start" : "npm run dev",
    url: baseURL,
    // En local, si `npm run dev` ya está arriba (el flujo normal de
    // desarrollo), Playwright lo reutiliza en vez de levantar uno propio.
    // En CI siempre arranca desde cero (no hay nada corriendo todavía).
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
