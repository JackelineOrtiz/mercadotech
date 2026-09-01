# Deploy — MercadoTech

Manual de despliegue. Se completa en 2 pasadas: la Fase 7.3 (variables y secretos, esta sección) y
la Fase 7.4 (flujo de despliegue + smoke tests + rollback, cuando existan las 3 cuentas humanas de
`MercadoTech_sesion7.md` — Supabase prod, Vercel, branch protection).

---

## 1. Variables y secretos (Fase 7.3)

`.env.example` ya estaba completo y comentado (decisión 5 de la spec de Sesión 7) — esta sección no
lo reescribe, lo audita: dónde vive cada variable en producción, quién la lee, y si es pública o
secreta.

### Regla de oro

**Los valores de las claves NUNCA pasan por el chat con Claude ni por el repositorio.** Claude
indica el NOMBRE de la variable y el entorno donde cargarla; los valores se pegan a mano en la
interfaz de Vercel (decisión 2 de la spec: 100% integración Git, sin CLI de Vercel, sin tokens en
GitHub Actions).

### Tabla de gobernanza

| Variable | Dónde vive | Quién la lee | Pública/Secreta |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel (Production + Preview), a mano | navegador y servidor | pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel (ambos entornos), a mano | navegador y servidor (RLS gobierna el alcance real) | pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (ambos), a mano — solo runtime de servidor | `lib/supabase/admin.ts`, usado únicamente en Route Handlers de `app/api/v1/` | **SECRETA** |
| `HUGGINGFACEHUB_API_TOKEN` | Vercel (ambos), a mano | `lib/ai/` vía Route Handlers | **SECRETA** |
| `NEXT_PUBLIC_SITE_URL` | Vercel, por entorno (prod = URL real; preview = automática) | redirects de auth (recuperación de contraseña, confirmación de email) | pública |
| `HUGGINGFACE_EMBEDDING_MODEL` / `HUGGINGFACE_CHAT_MODEL` (opcionales) | Vercel, solo si hace falta rotar el modelo gratuito | `lib/ai/` (default en `lib/constants/ai.ts` si se omiten) | pública |

Y la fila que NO existe a propósito: **GitHub Actions — ninguna variable, ningún secreto.** El CI
de la Sesión 6 (`.github/workflows/ci.yml`) corre contra un Supabase local efímero levantado por el
propio workflow (`supabase start` + `db reset` + seed de laboratorio) — no necesita, y nunca recibe,
ninguna de las variables de arriba.

### Reglas

* **Nunca commitear `.env*.local`.** Verificado: `.gitignore` ya excluye `.env*` (con excepción
  explícita de `!.env.example`) desde antes de esta fase.
* **Rotación inmediata** si una clave se expone: `SUPABASE_SERVICE_ROLE_KEY` se rota desde el
  dashboard de Supabase (Project Settings → API → Reset service_role secret);
  `HUGGINGFACEHUB_API_TOKEN` desde Hugging Face (Settings → Access Tokens → Revoke + crear uno
  nuevo). Después de rotar cualquiera de las dos: actualizar el valor en Vercel y hacer redeploy
  (ver regla siguiente).
* **Cambiar una variable en Vercel NO afecta a los deploys ya hechos** (decisión 10 de la spec): el
  build queda "congelado" con los valores que tenía al momento de desplegar. Tras cambiar cualquier
  variable, hace falta un redeploy manual desde el dashboard para que tome efecto.
* **Los previews de Vercel comparten el proyecto Supabase de PRODUCCIÓN** (decisión 9 de la spec —
  un solo proyecto por alumno, plan free). Riesgo aceptado y documentado: un preview de un PR puede
  tocar datos reales de producción. En un producto real, la corrección sería un proyecto Supabase de
  staging separado con su propio seed; queda fuera del alcance de este laboratorio.

### Greps anti-fuga (corridos de verdad, 2026-09-01)

```bash
# Tokens de Hugging Face (prefijo hf_)
grep -rn "hf_[A-Za-z0-9]" --include="*.ts" --include="*.tsx" --include="*.md" --include="*.json" .
# → vacío

# Claves secretas de Supabase (prefijo sb_secret_)
grep -rn "sb_secret_[A-Za-z0-9]" --include="*.ts" --include="*.tsx" --include="*.md" --include="*.json" .
# → vacío

# JWT legacy (prefijo eyJ) fuera de node_modules/config local
grep -rln "eyJ[A-Za-z0-9_-]\{20,\}" --include="*.ts" --include="*.tsx" --include="*.json" .
# → 1 hit en package-lock.json, falso positivo: es un hash npm "sha512-...eyJ..." por
#   coincidencia de substring, no un JWT real (verificado leyendo la línea completa).
```

`supabase/config.toml` tiene un `JWT_SECRET` de ejemplo (`super-secret-jwt-token-with-at-least-32-characters-long`)
y las claves `ANON_KEY`/`SERVICE_ROLE_KEY` del stack LOCAL de Supabase CLI — son los valores
públicos y conocidos que el propio CLI genera para cualquier instalación local (documentados en la
documentación oficial de Supabase), no un secreto real de este proyecto; no aplican las reglas de
arriba.

### Verificación al cierre de esta sección

* `git log --all -p -- .env.local`: sin resultados (nunca se commiteó un `.env.local` real).
* Los 3 greps de arriba: vacíos o con falso positivo explicado.
* La tabla cubre las 6 variables de `.env.example` + las 2 opcionales de modelo.

---

## 2. Flujo de despliegue (Fase 7.4)

### 2.1 Proyecto Supabase de producción (Tarea A) — completo

Proyecto `MercadoTech Datapath` (`gdlugailzawkugfxyxrg`), plan Free. Creado directo en el
dashboard (no vía CLI — la CLI solo puede linkear a un proyecto ya existente, no crearlo).

```bash
supabase login              # OAuth en el navegador; también acepta SUPABASE_ACCESS_TOKEN
                             # (generado en supabase.com/dashboard/account/tokens) si el login
                             # normal falla con "Could not create CLI login session" — ver 2.2
supabase link --project-ref gdlugailzawkugfxyxrg
supabase db push
```

### 2.2 Problemas reales encontrados linkeando/migrando (2026-09-01)

* **`supabase login` falló** con `Error: Could not create CLI login session` en la primera
  corrida. Se probó `brew upgrade supabase` (2.115.0 → 2.116.0) sin resolverlo — se resolvió con
  la alternativa `SUPABASE_ACCESS_TOKEN` (token personal generado en el dashboard, exportado en
  la terminal del usuario). El token generado durante esta sesión quedó parcialmente expuesto en
  una captura de pantalla pegada al chat — se le indicó al usuario revocarlo y generar uno nuevo
  una vez cerrada esta fase, como precaución (nunca se vio completo ni se usó desde fuera de su
  propia terminal).
* **`supabase db push` falló a mitad de las migraciones** con `ERROR: type "vector" does not
  exist (SQLSTATE 42704)` en `20260828100000_grant_service_role_execute_match_knowledge.sql`.
  Causa raíz real: esa migración referencia el tipo `vector` sin calificar el esquema
  (`extensions.vector`), y funcionaba en local/CI únicamente porque `extra_search_path` de
  `config.toml` agrega `"extensions"` al `search_path` del stack de `supabase start` — un ajuste
  exclusivo del entorno local que **`supabase db push` contra un proyecto remoto no aplica**. Es
  el mismo patrón, en un GRANT, que ya usa correctamente `create_match_knowledge.sql`
  (`extensions.vector(384)` calificado). Reproducido y confirmado el fix corriendo ambos casos
  directo contra Postgres local con `search_path` restringido a `public` antes de tocar el
  archivo real. Fix: calificar el tipo en el `GRANT` (commit — ver `docs/BITACORA.md`). Re-corrido
  `supabase db push`: las 27 migraciones quedaron aplicadas en producción.

**Lección para futuras migraciones que usen `vector` fuera de un `security definer`/`security
invoker` con su propio `set search_path`**: calificar SIEMPRE `extensions.vector`, nunca confiar
en `extra_search_path` de `config.toml` — ese ajuste no viaja a producción.

### 2.3 Primer deploy a Vercel (Tarea B) — dos bugs reales encontrados y corregidos

Import del repo (`Add New... → Project`, acceso limitado solo a `mercadotech` en el GitHub App de
Vercel) con **Root Directory = `mercadotech`** (obligatorio: el proyecto Next.js no vive en la
raíz del repo) y las 4 variables de la tabla de la Sección 1 cargadas antes del primer deploy.

#### Bug 1 (build-time): alias `@/*` sin resolver en el bundler de Edge Functions

**El primer deploy falló** en la etapa de empaquetado de funciones (el build en sí — `next build`
— terminó limpio, sin errores, generando las 24 rutas):

```
The Edge Function "middleware" is referencing unsupported modules:
- __vc__ns__/0/mercadotech/middleware.js: @/lib/supabase/middleware
```

Primera hipótesis (**descartada por evidencia**, dejada acá para que quede el registro honesto):
un bug de Turbopack en el build de producción (`next build --turbopack`) atado al hash de
`node_modules`. Se quitó `--turbopack` de `"build"` (Webpack para producción, commit `02c72ed`) —
**el error persistió IDÉNTICO** con el mismo commit reconstruido sin caché, descartando esa
hipótesis. La causa raíz real: `middleware.ts` es el ÚNICO archivo que Vercel empaqueta con un
pipeline de Edge Function separado del resto del build, y ese paso no resolvía el alias `@/*` de
`tsconfig.json` — se agrava con el Root Directory en subcarpeta (visible en el propio path del
error, `__vc__ns__/0/mercadotech/...`). Fix real: import relativo en vez de alias en
`middleware.ts` (`./lib/supabase/middleware` en vez de `@/lib/supabase/middleware`, commit
`c058e38`) — recién ahí el build llegó a "Ready".

`--turbopack` se dejó afuera del build de producción de todas formas (queda solo en `"dev"`) — no
era la causa de ESTE bug, pero sigue siendo la opción estable/madura para producción, y de yapa
bajó el "First Load JS shared by all" de 209 kB (el número que documenta `docs/PERFORMANCE.md` de
la Fase 7.2, ahora desactualizado) a 102 kB.

#### Bug 2 (runtime): `__dirname` no existe en el Edge Runtime real

Con el build ya en "Ready", la app cargaba **500 `MIDDLEWARE_INVOCATION_FAILED`** en cada request:
`[ReferenceError: __dirname is not defined]` (Vercel → Logs → click en el error). Ninguna
herramienta local (`next dev`, `next start`, ni siquiera `next build` con Webpack) reproduce el
error porque ninguna ejecuta el runtime Edge real de Vercel, solo lo emulan.

Causa raíz confirmada reproduciendo el pipeline real de Vercel en local (`vercel build`, con
permiso explícito del usuario para usar la CLI solo para esto — nunca para desplegar): el bundle
de la Edge Function (`.vercel/output/functions/middleware.func/`) incluye
`node_modules/next/dist/compiled/ua-parser-js/ua-parser.js` — un archivo **vendorizado dentro del
propio Next.js**, no de nuestro código ni de `@supabase/ssr`, que Next.js agrega automáticamente a
cualquier middleware y que referencia `__dirname`. El propio `vercel build` ya avisaba la salida:
`Warning: middleware.ts uses the deprecated "edge" runtime. Migrate to the Node.js runtime...`

Fix: `middleware.ts` — `export const config = { runtime: "nodejs", matcher: [...] }` (Node.js
Middleware, GA desde Next.js 15.2, estamos en 15.5.23) en vez del runtime Edge por default. Mismo
`updateSession`, sin cambios de comportamiento — solo corre en un runtime con Node.js completo
(`__dirname` incluido), en vez del sandbox restringido de Edge. Confirmado en el artefacto real:
`.vc-config.json` del `middleware.func` pasó de `"runtime": "edge"` a `"runtime": "nodejs24.x"`.

Verificación completa antes de commitear: `vercel build` real (no solo `next build`) compila sin
warnings de runtime deprecado; `npm run lint`/`type-check` exit 0; `npm run test` 218/218;
`npm run test:e2e` 24/24 (`supabase db reset` fresco, incluye los tests que ejercitan el guard de
auth del middleware). `.vercel/` y `.env.local` generados por la CLI se descartaron después
(`rm -rf`, ya estaban en `.gitignore`) y se cerró la sesión de `vercel logout` al terminar.

#### Bug 3 (runtime): ESM real de Node — `"type": "module"` faltante + import sin extensión

Con el runtime ya en Node.js (Bug 2 resuelto), cada request seguía tirando 500
`MIDDLEWARE_INVOCATION_FAILED`, ahora con un error distinto y mucho más claro:

```
SyntaxError: Cannot use import statement outside a module
Failed to load the ES module: /var/task/mercadotech/middleware.js.
Make sure to set "type": "module" in the nearest package.json
```

Causa real: a diferencia del runtime Edge (que arma un bundle único), el output de "Node.js
Middleware" de Next.js 15.5.23 NO bundlea — dentro de `middleware.func/` deja `middleware.ts` y sus
imports relativos como archivos `.js` separados con imports reales entre sí (confirmado
inspeccionando `.vercel/output/functions/middleware.func/mercadotech/`, que incluye una copia
literal de nuestro `package.json` real — es "el `package.json` más cercano" que menciona el error).
Sin `"type": "module"` ahí, Node interpreta el archivo como CommonJS y el `import` (que Next.js no
transforma a `require`) revienta.

Fix intermedio: agregar `"type": "module"` a `mercadotech/package.json` (verificado antes: sin
archivos `.js` sueltos en la raíz que dependieran de CommonJS — todos los configs ya son
`.ts`/`.mjs`/`.mts`). Con esto el `SyntaxError` desapareció, pero apareció el SIGUIENTE problema, a
un nivel más profundo: el resolutor ESM real de Node (a diferencia de "bundler" en `tsconfig.json`)
exige la extensión `.js` explícita en los imports relativos — `./lib/supabase/middleware` sin
extensión no resuelve. Escribir la extensión en la fuente (`./lib/supabase/middleware.js`) rompe en
la otra punta: Webpack (el bundler real de `next build`) no resuelve un `.js` que apunta a un
archivo `.ts` real — "Module not found". Los dos requisitos (ESM real de Node vs. Webpack) son
incompatibles entre sí para DOS archivos separados con un import relativo entre ellos.

Fix final: `updateSession` (antes en `lib/supabase/middleware.ts`) se fusionó directamente DENTRO
de `middleware.ts` — confirmado que ningún otro archivo lo importaba. Con todo en un solo archivo
no queda ningún import relativo propio que resolver, y el problema desaparece para los dos lados a
la vez. Se actualizaron los 4 comentarios que referenciaban la ruta vieja (`app/(seller)/layout.tsx`,
`app/(shop)/asistente/page.tsx`, `app/(admin)/layout.tsx`, `e2e/tests/seller-negative.spec.ts`).
Excepción real y documentada al patrón de "4 clientes de Supabase" de `CLAUDE.md` (`client`/
`server`/`middleware`/`admin`) — motivada por una limitación real y verificada de esta feature tan
nueva de Next.js, no por preferencia de diseño.

**Hallazgo adicional durante esta verificación** (no relacionado al bug): al limpiar los archivos
que generó la CLI de Vercel (`.env.local`, `.vercel/`) se borró por error el `.env.local` REAL de
desarrollo local (no el que generó la CLI) — se repuso con las credenciales del Supabase LOCAL
(`supabase status -o env`, son las públicas y conocidas del stack local, no un secreto real), pero
el valor de `HUGGINGFACEHUB_API_TOKEN` que tenía cargado se perdió — el usuario tiene que volver a
pegarlo ahí (no hace falta pasarlo por el chat).

Verificación final: `vercel build` real compila y arma un `middleware.func` de un solo archivo;
`npm run build && npm run start` REAL (no solo `next dev`) sirve `200` en `/`; `npm run test`
218/218; `npm run test:e2e` 24/24 con `supabase db reset` fresco.

### 2.4 Pendiente

_Falta: branch protection (Tarea C, al cierre de esta fase), smoke tests post-deploy (Sección 3),
rollback (Sección 4)._

## 3. Smoke tests post-deploy (Fase 7.4)

_Pendiente — depende de la sección 2._

## 4. Rollback (Fase 7.5)

_Pendiente — depende de la sección 2._
