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

_Pendiente — requiere las 3 tareas humanas de `MercadoTech_sesion7.md` (proyecto Supabase de
producción, cuenta de Vercel conectada a GitHub, branch protection). Se completa cuando esas 3
cuentas existan._

## 3. Smoke tests post-deploy (Fase 7.4)

_Pendiente — depende de la sección 2._

## 4. Rollback (Fase 7.5)

_Pendiente — depende de la sección 2._
