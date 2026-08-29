import { fileURLToPath } from "node:url";
import path from "node:path";

// env.ts — carga la .env.local de la RAÍZ del proyecto Next.js
// (mercadotech/), el mismo archivo que usa la app web y
// scripts/index-all.ts. Node no carga .env.local sola como sí hace Next
// (lección 9 de la Guía) — se usa el mismo mecanismo que ya prueba
// scripts/index-all.ts: `process.loadEnvFile(...)`, la API nativa de Node
// (20.6+), NO un parser manual — el texto de la spec habla de "parseo
// manual" pero el código real de index-all.ts (cabecera, Fase 4.3) usa
// esta API nativa, ya confirmada funcionando desde la Sesión 4.
//
// CORRECCIÓN de la Fase 5.5 (verificado con el claude-code-guide antes de
// escribir .mcp.json): la primera versión de esta función resolvía
// ".env.local" relativo a process.cwd(), asumiendo que el proceso SIEMPRE
// se lanza con cwd = mercadotech/ (cierto para `npx tsx mcp/src/index.ts`
// corrido a mano desde ahí, y para scripts/index-all.ts). Pero Claude
// Code lanza los servidores de .mcp.json con cwd = el directorio que
// contiene ese .mcp.json (documentado: "Working Directory: Project
// directory"), y en este repo .mcp.json vive en la raíz del repo, un
// nivel arriba de mercadotech/ (ahí es donde Claude Code ya descubre
// .claude/skills/, confirmado tras el reinicio de la Fase 5.1) — así que
// el cwd real del proceso NO es predecible de antemano. Se resuelve la
// ruta de forma robusta: relativa a la ubicación de ESTE ARCHIVO
// (import.meta.url), no al cwd — funciona igual sin importar desde dónde
// se lance el proceso. mcp/ NO tiene su propia .env: una sola fuente de
// secretos (decisión 2), ahora garantizado por la ruta absoluta en vez de
// por una convención de invocación.
const ENV_LOCAL_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".env.local",
);

const REQUIRED_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function loadEnv(): void {
  try {
    process.loadEnvFile(ENV_LOCAL_PATH);
  } catch {
    throw new Error(
      `No se encontró .env.local en ${ENV_LOCAL_PATH} (la raíz de mercadotech/). ` +
        "Copia mercadotech/.env.example a mercadotech/.env.local y llena las credenciales.",
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
