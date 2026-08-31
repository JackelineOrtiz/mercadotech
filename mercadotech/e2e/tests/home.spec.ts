import { test, expect } from "@/e2e/fixtures/test";
import { CatalogPage } from "@/e2e/pages/CatalogPage";

// Smoke mínimo de la Fase 6.4: solo prueba que la tubería completa
// funciona (Page Object + data-testid + webServer) — los flujos reales
// (comprador/vendedor) llegan en 6.5/6.6.
test("la home carga y muestra el grid de productos", async ({ page }) => {
  const catalog = new CatalogPage(page);

  await catalog.goto();

  await expect(catalog.grid()).toBeVisible();
  await expect(catalog.productCards().first()).toBeVisible();
});
