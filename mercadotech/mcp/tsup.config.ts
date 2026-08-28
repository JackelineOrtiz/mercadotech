import { defineConfig } from "tsup";

// Build de producción: un solo dist/index.js. `tsconfig: "./tsconfig.json"`
// le pasa a esbuild el alias @/* -> ../* de este paquete (decisión 7) —
// esbuild lee "paths" del tsconfig de forma nativa, así que
// services/lib/ai/lib/constants/types (que NO son un paquete instalable,
// solo fuente de este repo) quedan BUNDLEADOS dentro de dist/index.js.
// Los 3 paquetes reales de node_modules (@modelcontextprotocol/sdk, zod,
// @supabase/supabase-js) quedan como import normal, resueltos en tiempo de
// ejecución: los dos primeros están en mcp/node_modules (Prompt 0);
// @supabase/supabase-js NO se reinstala acá — Node lo encuentra subiendo
// directorios desde mcp/dist/ hasta mercadotech/node_modules/, donde ya
// vive como dependencia del proyecto web (misma idea de "una sola fuente"
// que la decisión 2 del env, aplicada a dependencias en vez de secretos).
export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  tsconfig: "./tsconfig.json",
  external: ["@modelcontextprotocol/sdk", "zod", "@supabase/supabase-js"],
});
