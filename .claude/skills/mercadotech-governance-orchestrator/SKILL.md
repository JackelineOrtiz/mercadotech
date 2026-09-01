---
name: mercadotech-governance-orchestrator
description: >
  Orquestador del ciclo de gobernanza completo de MercadoTech: corre, en UNA sola invocación y en
  el orden correcto, mercadotech-architecture-enforcer → mercadotech-code-reviewer → (si hay
  errores críticos, se detiene y pide el fix antes de seguir) → mercadotech-automatic-validator, y
  entrega un solo reporte consolidado + un mensaje de commit listo para usar. Reemplaza tener que
  invocar las 3 Skills a mano y decidir vos el orden. Úsalo al cerrar cualquier feature o fix,
  cuando pidan "corré el ciclo completo", "¿esto está listo para commitear?", "revisá todo antes de
  pushear", o cuando invoquen /mercadotech-governance-orchestrator.
---

# Governance Orchestrator — MercadoTech

## Para qué sirve

Es el capataz de obra: no inspecciona nada él mismo (eso ya lo hacen las otras 3 Skills), pero
sabe en qué orden llamar a cada inspector, cuándo parar la obra si algo está mal, y cuándo firmar
el permiso final. Antes de esta Skill, cerrar una feature significaba invocar
`mercadotech-architecture-enforcer`, después `mercadotech-code-reviewer`, corregir a mano, y recién
después `mercadotech-automatic-validator` — tres decisiones manuales de secuencia, repetidas en
cada feature. Esta Skill las colapsa en una.

## Qué NO hace

- No reemplaza el criterio de ninguna de las 3 Skills que orquesta — nunca reescribe sus reglas,
  solo las invoca en orden y interpreta su veredicto.
- No corrige código. Si `mercadotech-code-reviewer` encuentra un error crítico, el orquestador
  SE DETIENE ahí y devuelve la lista exacta de qué arreglar — la corrección la hace un humano o
  Claude en el hilo principal, nunca esta Skill.
- No decide si algo es una buena decisión de diseño a largo plazo — eso sigue siendo
  `mercadotech-tech-lead`, y NO forma parte de este ciclo (el ciclo de cierre de CLAUDE.md es
  enforcer → reviewer → validator; tech-lead es una revisión aparte, más profunda, no automática).
- No pushea ni commitea por sí sola — entrega el mensaje de commit listo, pero el commit/push lo
  hace el humano o Claude, como siempre.

## Flujo (en este orden exacto, sin saltarse pasos)

1. **Reunir el diff**: identificar la lista exacta de archivos tocados (nuevos o modificados) del
   cambio a cerrar. Si no está claro, correr `git status --short` y `git diff --stat` de verdad.

2. **Paso 1 — `mercadotech-architecture-enforcer`** sobre esos archivos.
   - Si algún archivo se **RECHAZA**: detenerse acá. Reportar la regla violada y la ubicación
     correcta tal cual la devuelve el enforcer. No seguir a los pasos 2 y 3 — mover código de
     lugar antes de evaluar su calidad no tiene sentido.
   - Si todos **APRUEBAN**: seguir al paso 2.

3. **Paso 2 — `mercadotech-code-reviewer`** sobre los mismos archivos.
   - Si hay **errores críticos**: detenerse acá. Reportar la lista exacta (archivo:línea, qué está
     mal, por qué importa) tal cual la devuelve el reviewer, y pedir que se corrijan antes de
     volver a invocar esta Skill desde cero (no solo el paso 3 — un fix puede introducir un
     problema de ubicación que el enforcer no vio la primera vez, así que el reinicio es completo).
   - Si hay solo errores importantes o sugerencias (sin críticos): anotarlos en el reporte final
     como pendientes no bloqueantes, y seguir al paso 3 igual.

4. **Paso 3 — `mercadotech-automatic-validator`**, pasándole como contexto que los pasos 1 y 2 ya
   se corrieron con sus resultados reales (no hace falta que el validator los re-invoque de cero
   si esta Skill ya tiene el veredicto fresco de este mismo ciclo — pero SÍ debe correr de verdad
   `lint`/`type-check`/`build`/`test`/`test:e2e` él mismo, nunca asumir que ya pasaron de una
   corrida anterior).

5. **Si el validator da `## VALIDACIÓN FALLIDA` únicamente por `npm run test` o `npm run test:e2e`**
   (nunca por lint/type-check/build, ni por un archivo rechazado/crítico de los pasos 1-2 — esos
   SIEMPRE bloquean sin excepción): antes de detenerse, verificar si el/los test(s) que fallan son
   una regresión real de este cambio o un problema YA existente sin relación con los archivos
   tocados. Hallazgo real (ver `docs/BITACORA.md`, entrada del `governance-orchestrator`): un
   `test:e2e` puede fallar por algo que no tiene nada que ver con el diff evaluado (ej.
   `seller-flow.spec.ts` fallando en firefox/webkit por un timing de drag&drop del kanban, mientras
   el cambio evaluado era `/producto/[id]`). Verificar de verdad, nunca asumir:
   - `git stash -u` (deja el working tree en el estado previo al cambio — cuidado: esto también
     esconde archivos nuevos sin trackear, así que confirmar con `git status --short` que quedó
     limpio antes de continuar).
   - Re-correr SOLO el/los test(s) que fallaron, con `supabase db reset` fresco antes.
   - `git stash pop` para restaurar el cambio evaluado, sea cual sea el resultado.
   - Si el mismo test falla igual **sin** el cambio: es deuda pre-existente, no una regresión de
     este diff. No bloquea el ciclo — se anota como "Deuda técnica encontrada, no causada por este
     cambio" en el reporte final y (si no hay uno ya) se sugiere `spawn_task` para arreglarla aparte.
   - Si el test pasa **sin** el cambio y falla **con** él: es una regresión real. Bloquea el ciclo
     igual que cualquier otro fallo del validator — reportar y detenerse, no seguir a este atajo de
     nuevo la próxima vez sin haber corregido primero.

6. **Si el validator da `## VALIDACIÓN APROBADA`** (o `FALLIDA` solo por algo confirmado
   pre-existente en el paso 5): generar un mensaje de commit en el estilo real del repo (ver
   `git log` reciente para el tono: hallazgo → causa raíz → fix → verificación), listo para
   copiar/pegar o commitear directo. Si el paso 5 encontró deuda pre-existente, mencionarla en el
   cuerpo del mensaje sugerido como nota aparte, no como parte del fix de este commit.

7. **Si el validator da `## VALIDACIÓN FALLIDA`** por cualquier otro motivo (lint, type-check,
   build, un archivo rechazado en el paso 1, un crítico del paso 2, o un test confirmado como
   regresión real en el paso 5): reportar el ítem fallido exacto y detenerse — no generar mensaje
   de commit.

## Formato de salida

```
## Governance Orchestrator — <descripción corta del cambio>

Archivos evaluados: <lista>

### Paso 1 — Architecture Enforcer
<veredicto, uno por archivo si hace falta>

[si RECHAZAR: reportar y DETENER acá, no incluir los pasos 2-4]

### Paso 2 — Code Reviewer
Nota: X/10
<críticos / importantes / sugerencias>

[si hay críticos: reportar y DETENER acá, no incluir el paso 4]

### Paso 3 — Automatic Validator
<checklist completo tal cual lo devuelve la Skill>

[si test/test:e2e falló: sección "Verificación de pre-existencia (git stash)" con el resultado real
 — reproduce sin el cambio: sí/no — antes de decidir el resultado final]

### Resultado final
## CICLO COMPLETO — LISTO PARA COMMITEAR
(o)
## CICLO COMPLETO — BLOQUEADO EN PASO <n>

[si listo para commitear]
### Mensaje de commit sugerido
```
<mensaje en el estilo real del repo>
```

[si se encontró deuda pre-existente no relacionada, aunque el ciclo haya quedado LISTO]
### Deuda técnica encontrada (no causada por este cambio)
- <descripción, cómo se reprodujo, dónde reportarla>
```

La última línea de la sección "Resultado final" es siempre, literalmente, una de esas dos frases
en mayúsculas — para que se pueda reconocer el veredicto sin leer todo el reporte.

## Ante contradicción

`CLAUDE.md` gana. El orden del ciclo (enforcer → reviewer → validator) es el que ya está
documentado en `CLAUDE.md` §Estructura del repositorio — si ese archivo cambia el orden o agrega un
paso, esta Skill se actualiza para seguirlo, no al revés.
