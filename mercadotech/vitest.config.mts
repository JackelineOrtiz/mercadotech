import { defineConfig } from "vitest/config";
import path from "node:path";

const rootDir = import.meta.dirname;

// environment "node" (decisión 6 de la spec de la Sesión 6): esta sesión
// no testea componentes React — sin jsdom ni Testing Library, que ni
// siquiera se instalaron (Prompt 0).
//
// El alias replica EXACTAMENTE el de tsconfig.json (paths: "@/*" -> "./*",
// sin baseUrl, relativo a la raíz de mercadotech/) para que un test
// importe igual que la app real: "@/services/cart.service", nunca una
// ruta relativa larga.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // Reemplaza (no extiende) el exclude por default de Vitest — se listan
    // los 4 explícitos que pide la spec, node_modules incluido a propósito
    // aunque ya viniera por default, para que quede escrito y no dependa
    // de un comportamiento implícito.
    exclude: ["**/node_modules/**", "mcp/**", "e2e/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Cobertura limitada a lib/ y services/ (decisión de la spec): son
      // las dos carpetas con lógica pura/de negocio que esta sesión testea
      // — el resto (components/, hooks/, app/) queda fuera del reporte a
      // propósito, no porque nadie los toque.
      include: ["lib/**", "services/**"],
    },
  },
});
