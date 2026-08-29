# Revisión de gobernanza — cierre de Sesión 5 (Fase 5.6)

Ciclo completo de gobernanza sobre código REAL de las Sesiones 2-5, corrido
con las Skills de la Fase 5.1 en conversación nueva: `mercadotech-tech-lead`
sobre `services/` y `hooks/` completos, `mercadotech-code-reviewer` sobre
`lib/ai/`, los 3 Route Handlers de `app/api/v1/` y `mcp/src/` completo. Este
documento consolida ambos informes, aplica las correcciones de bajo riesgo
en commits separados, y cierra con el veredicto binario de
`mercadotech-automatic-validator`.

**Regla seguida (decisión 10 de la spec):** lo que `docs/BITACORA.md` ya
documenta como deuda aceptada se justifica con su enlace, no se re-corrige.
Un hallazgo solo cuenta como nuevo si no tiene entrada previa ahí.

## Hallazgos

| Hallazgo | Severidad | Veredicto | Evidencia |
|---|---|---|---|
| `app/api/v1/reindex/route.ts` no verificaba que el caller fuera dueño del `sourceId` reindexado — cualquier usuario autenticado podía forzar el reindexado de un producto o artículo ajeno, gastando la cuota compartida de Hugging Face | importante | **corregido** ([`f4e2a9a`](https://github.com/JackelineOrtiz/mercadotech/commit/f4e2a9a)) | Verificado real contra el servidor: producto propio → 200; producto ajeno → 403; id inexistente (post-delete) → 200 `removed` (comportamiento preexistente intacto); `articulo_soporte` como no-admin → 403; como admin → 200 |
| `cart.service.updateQuantity` no clampeaba la cantidad al stock actual, a diferencia de `addItem` (misma archivo, mismo dominio) | menor | **corregido** ([`e76ea81`](https://github.com/JackelineOrtiz/mercadotech/commit/e76ea81)) | lint/type-check/build limpios; sin cambio de comportamiento visible (`CartItemRow` ya solo ofrece 1..stock en su `<select>`) |
| `(err as Error).message` repetido en 21 sitios de 14/16 hooks — cast sin chequeo de tipo, inconsistente con `toErrorMessage` de `lib/api-response.ts` | menor | **aceptado como deuda** | No rompe en la práctica: todo lo que los services de este repo lanzan trae `.message` real (`Error` o `PostgrestError`). Demasiado disperso para un commit "pequeño y separado" de este lab — candidato a extraer un helper compartido en una sesión con tests (Sesión 6) |
| `mcp/src/resources/seller.ts`, el callback `list` hace un fetch doble (perfil + productos) por cada vendedor para armar la lista de instancias | menor | **aceptado como deuda** | Con 2 vendedores en el seed es inmediato; no hay evidencia de que el catálogo vaya a crecer lo suficiente para que importe en esta sesión — se revisita si el número de vendedores crece |
| `useProductForm` (336 líneas) mezcla validación + gestión de galería de imágenes + submit | — | **falso positivo** (revisado y descartado) | Es cohesión de dominio (ciclo de vida completo de un formulario con imágenes drag & drop, decisión ya documentada en la Fase 3.7), no una mezcla arbitraria de responsabilidades — partirlo introduciría acoplamiento artificial entre las partes en vez de reducirlo |
| Sin `public_profiles` (nombres de vendedores/compradores no se resuelven) | — | aceptado como deuda | `docs/BITACORA.md` §Deuda técnica, Sesión 3 |
| Cancelar un pedido no repone stock | — | aceptado como deuda | `docs/BITACORA.md` §Deuda técnica, Sesión 3 |
| Pedido multi-vendedor con `orders.status` único (sin desglose por vendedor) | — | aceptado como deuda | `docs/BITACORA.md` §Deuda técnica, Sesión 3 |
| El vendedor podría, a nivel de RLS puro, poner `cancelado` o retroceder el estado de un pedido | — | aceptado como deuda | `docs/BITACORA.md` §Deuda técnica, Sesión 3 (mitigado por `canMove` en `useSellerOrders`, releído y confirmado vigente en este lab) |
| `ilike` provisional en la búsqueda de texto del catálogo | — | aceptado como deuda | `docs/BITACORA.md` §Deuda técnica, Sesión 3/4 |
| Vulnerabilidades transitivas de Next (`npm audit`) | — | aceptado como deuda | `docs/BITACORA.md` §Deuda técnica, Sesión 3 |
| `hasRelevantContext` no distingue "sin información" de "corpus chico con ruido de fondo alto" | — | aceptado como deuda | `docs/BITACORA.md` §Deuda técnica, Sesión 4; calibración completa en `docs/RAG.md` |
| La sugerencia de abrir un ticket ante "sin información" es del LLM, no determinista | — | aceptado como deuda | `docs/BITACORA.md` §Deuda técnica, Sesión 4 |

## Los dos informes completos

### `mercadotech-tech-lead` sobre `services/` y `hooks/`

| Criterio | Nota | Justificación |
|---|---|---|
| SRP / SOLID | 8/10 | Casi todos los services/hooks tienen una responsabilidad clara y angosta. `useProductForm` mezcla varias operaciones pero es cohesión de dominio, no dispersión (ver fila de falso positivo arriba). |
| Acoplamiento entre capas | 9/10 | `components → hooks → services → lib/supabase` se respeta en los 32 archivos leídos, sin excepciones — la corrección de la Fase 3.8 (mover `useAuth` fuera de `@/lib/supabase` directo) se sostiene. |
| Deuda técnica | 7/10 → 9/10 tras corregir | Dos hallazgos nuevos reales, ambos corregidos en este lab (ver tabla). El resto contrasta limpio contra `docs/BITACORA.md`. |
| Mantenibilidad | 9/10 | Comentarios explican consistentemente el "por qué" (`extractFileNumber` en `useProductForm`, el criterio de `canMove` en `useSellerOrders`) — no hace falta arqueología. |
| Escalabilidad | 8/10 | El patrón fetch-then-setState manual, repetido en 14 hooks, es predecible pero empezaría a pedir una librería de data-fetching con más pantallas — no es un techo cercano todavía. |
| Orden del pipeline RAG | 9/10 | `chat.service.ask` mantiene embedding → búsqueda → contexto → completion sin saltos; ningún hook de esta lista toca `lib/ai/` directo. |

**Nota ponderada final: 8.2/10** (8.5/10 tras aplicar las dos correcciones).

### `mercadotech-code-reviewer` sobre `lib/ai/`, Route Handlers y `mcp/src/`

**Nota: 8/10** (9/10 tras corregir el hallazgo importante).

- **Errores críticos:** ninguno.
- **Errores importantes:** el gap de autorización de `/api/v1/reindex` (ver tabla — corregido).
- **Sugerencias:** el fetch doble de `seller.ts` (aceptado como deuda) y el patrón `(err as Error).message` (aceptado como deuda, mismo hallazgo que reportó el tech-lead desde el otro checklist).
- Sin objeciones en `lib/ai/` (orden del pipeline intacto, tunables 100% en `lib/constants/ai.ts`, errores 401/modelo/cuota siguen el patrón documentado) ni en `mcp/src/` más allá de lo ya listado (cliente explícito por tool confirmado en las 10, sin `any`, sin `console.log` fuera de `stderr-redirect.ts`, cliente admin confinado a los 4 archivos esperados: `lib/supabase/admin.ts`, `app/api/v1/reindex/route.ts`, `mcp/src/context.ts`, `mcp/src/env.ts`).

## Orden de las correcciones

Se corrigió de menor a mayor riesgo: primero el clamp de `cart.service.updateQuantity`
(una función, sin ramas de control nuevas, imposible de romper algo visible ya
que la UI nunca manda valores fuera de rango), y después la autorización de
`/api/v1/reindex` (agrega una rama 403 nueva a un Route Handler — más
superficie de cambio, aunque los únicos callers reales confirmados,
`useProductForm`/`useSellerProducts`, siempre reindexan productos propios).
Cada una se verificó con lint + type-check + build, y la segunda además
contra el servidor real corriendo (no solo el build).

## Validación final

Salida literal de `mercadotech-automatic-validator` sobre el estado final del
repo (tras las dos correcciones de arriba):

```
## Validación automática — MercadoTech

- [x] architecture-enforcer: APROBAR (0 archivos rechazados — services/cart.service.ts
      y app/api/v1/reindex/route.ts, únicos tocados en esta fase, respetan
      las 9 reglas: cliente admin usado exactamente donde corresponde, sin
      capa REST nueva, sin tunables hardcodeados)
- [x] code-reviewer: 0 errores críticos (el único importante detectado, el
      gap de /api/v1/reindex, ya está corregido)
- [x] npm run lint: exit 0
- [x] npm run type-check: exit 0
- [x] npm run type-check en mcp/: exit 0
- [x] npm run build: exit 0
- [ ] npm run test: N/A (script no existe todavía, llega en la Sesión 6)

### Ítems fallidos
Ninguno.

## VALIDACIÓN APROBADA
```
