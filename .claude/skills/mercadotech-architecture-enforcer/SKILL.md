---
name: mercadotech-architecture-enforcer
description: >
  Gate PREVIO de ubicación y dependencias para el repo de MercadoTech: verifica, ANTES de crear o
  mover un archivo, si va en la capa correcta (components/hooks/services/lib/app/mcp) y si importa
  solo lo que su capa tiene permitido — nunca estilo, naming ni lógica de negocio. Úsalo cuando
  vayas a crear un componente, hook, service o archivo de mcp/ nuevo, cuando la petición sea del
  tipo "agrega una página que consulte productos directamente de Supabase", "crea un componente que
  llame a Hugging Face", "dónde pongo esta función que arma el prompt del asistente", o "agrega un
  endpoint REST para listar categorías" — o cuando invoquen /mercadotech-architecture-enforcer.
---

# Architecture Enforcer — MercadoTech

## Para qué sirve

Rechazar UBICACIONES y DEPENDENCIAS incorrectas ANTES de que se escriba una sola línea de la
lógica en sí. No es una revisión de calidad — es un inspector de permisos de obra: "¿este muro
puede ir aquí?", no "¿está bien construido el muro?". Eso último es
`mercadotech-code-reviewer`.

**Esta Skill NUNCA edita código.** Solo reporta: RECHAZAR (con la regla violada y la ubicación
correcta) o APROBAR.

Fuente de verdad: `CLAUDE.md` (raíz del repo) y la estructura real del repositorio. Toda regla de
abajo se puede rastrear a una línea de `CLAUDE.md`, a la spec de la sesión correspondiente, o a la
carpeta real que ya existe en el repo — ninguna es invención de esta Skill.

---

## Checklist de rechazo

Evaluar la petición contra cada fila; basta UNA coincidencia para rechazar.

| # | Pregunta | Si la respuesta es sí | Ubicación correcta |
|---|---|---|---|
| 1 | ¿Un componente (`components/`) hace `fetch`, llama a un `service` o importa `@/lib/supabase*`? | Rechazar | El fetching va en un **hook** (`hooks/`) que llama al `service`; el componente recibe props ya resueltas |
| 2 | ¿Un `service` (`services/*.service.ts`) importa React, algo de `app/`, o cualquier cosa de `components/`/`hooks/`? | Rechazar | Un service es lógica de negocio pura + cliente Supabase inyectable — no conoce React |
| 3 | ¿Algo fuera de `lib/ai/` importa `@huggingface/*` o hace `fetch` al router de Hugging Face? | Rechazar | Toda llamada a Hugging Face vive en `lib/ai/` (`embeddings.ts`, `completion.ts`) |
| 4 | ¿Algo fuera de `lib/voice/` usa la Web Speech API (`SpeechRecognition`, `speechSynthesis`)? | Rechazar | `lib/voice/` (carpeta ya existe, vacía — rige desde la Sesión 8, se aplica ya) |
| 5 | ¿El cliente admin (`lib/supabase/admin.ts` o uno construido a mano con `SUPABASE_SERVICE_ROLE_KEY`) se usa fuera de `app/api/v1/`, `scripts/` o `mcp/src/context.ts`? | Rechazar | Esas tres son las únicas ubicaciones donde el admin es legítimo — nunca en un componente, hook o service llamado desde el navegador |
| 6 | ¿Se propone una capa REST nueva en `app/api/v1/` para un CRUD que ya funciona vía hooks + RLS (ej. "un endpoint para listar productos")? | Rechazar | Reusar el hook → service → RLS existente; `app/api/v1/` es solo para lo que NO puede viajar al navegador (token HF, cliente admin) — hoy: `chat`, `reindex`, `search/semantic` |
| 7 | ¿Un tunable (modelo de IA, threshold, top K, límite de paginación, límite de caracteres…) se hardcodea fuera de `lib/constants/`? | Rechazar | El tunable va en el archivo de `lib/constants/` que le corresponda por dominio (`ai.ts`, `catalog.ts`, `orders.ts`, `product.ts`, `roles.ts`, `tickets.ts`) — o uno nuevo si el dominio no tiene archivo todavía |
| 8 | ¿Lógica de negocio nueva aparece fuera de `mcp/` para el servidor MCP, o `mcp/` reimplementa algo que ya existe en `services/`/`lib/ai/`? | Rechazar | `mcp/` es un consumidor más de `services/` y `lib/ai/` — nunca reimplementa una consulta que un service ya resuelve. Si de verdad falta un service, se agrega a `services/` (para toda la app), no dentro de `mcp/` |
| 9 | ¿Un archivo de `mcp/src/` importa algo de `app/`, `components/` o `hooks/`? | Rechazar | `mcp/` solo puede importar de `services/`, `lib/ai/`, `lib/constants/` y `types/` — nunca de las capas de presentación de la web |

Si ninguna fila coincide: **APROBAR**.

## Qué NO evalúa esta Skill

- Estilo, naming, formato — no es un linter.
- Si la lógica de negocio es correcta — eso es `mercadotech-code-reviewer`.
- Si `lint`/`type-check`/`build` pasan — eso es `mercadotech-automatic-validator`.
- Si la decisión de diseño es la mejor a largo plazo — eso es `mercadotech-tech-lead`.

## Formato de salida

```
## Architecture Enforcer

Archivo/petición evaluada: <ruta o descripción>
Veredicto: RECHAZAR | APROBAR

[si RECHAZAR]
Regla violada: #<n> — <texto de la regla>
Ubicación correcta: <dónde debería ir>
```

Si se evalúan varios archivos en una misma petición, un bloque por archivo.

## Ante contradicción

`CLAUDE.md` gana. Si esta Skill y `CLAUDE.md` parecen decir cosas distintas, releer
`CLAUDE.md` completo antes de dar el veredicto — puede haber cambiado desde que esta Skill se
escribió.
