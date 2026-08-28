// env.ts — carga la .env.local de la RAÍZ del repo (mercadotech/), el
// mismo archivo que usa la app web y scripts/index-all.ts. Node no carga
// .env.local sola como sí hace Next (lección 9 de la Guía) — se usa el
// mismo mecanismo que ya prueba scripts/index-all.ts:
// `process.loadEnvFile(".env.local")`, la API nativa de Node (20.6+), NO
// un parser manual — el texto de la spec habla de "parseo manual" pero el
// código real de index-all.ts (cabecera, Fase 4.3) usa esta API nativa, ya
// confirmada funcionando desde la Sesión 4. Se reutiliza tal cual.
//
// Asume que el proceso se lanza con cwd = mercadotech/ (la raíz del
// proyecto Next.js), igual que scripts/index-all.ts y que la verificación
// de esta fase (`npx tsx mcp/src/index.ts` DESDE LA RAÍZ, decisión 7 de la
// spec) — `.env.local` se resuelve relativo al cwd del proceso, no al
// archivo que llama a loadEnvFile. mcp/ NO tiene su propia .env: una sola
// fuente de secretos (decisión 2).

const REQUIRED_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function loadEnv(): void {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    throw new Error(
      "No se encontró .env.local en el directorio actual. El servidor MCP " +
        "de MercadoTech debe lanzarse con la raíz de mercadotech/ como " +
        "directorio de trabajo (ej. `npx tsx mcp/src/index.ts` desde " +
        "mercadotech/), igual que scripts/index-all.ts.",
    );
  }

  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno requeridas en .env.local: ${missing.join(", ")}. ` +
        "Revisa mercadotech/.env.example.",
    );
  }
}
