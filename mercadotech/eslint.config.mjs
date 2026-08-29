import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "supabase/**",
      // mcp/ es un paquete npm propio (Sesión 5) con su propio
      // type-check; mcp/dist/ es su build empaquetado por esbuild —
      // no hay nada útil que lintear ahí (Fase 5.5 en adelante).
      "mcp/dist/**",
      // coverage/ (Sesión 6, Fase 6.1) es el reporte HTML de v8 —
      // JS vendorizado del propio reporte, no código del proyecto.
      // Gitignorado, pero ESLint no respeta .gitignore solo: hallazgo
      // real al correr npm run lint tras el primer test:coverage.
      "coverage/**",
    ],
  },
];

export default eslintConfig;
