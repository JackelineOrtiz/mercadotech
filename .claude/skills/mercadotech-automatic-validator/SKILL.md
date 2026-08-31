---
name: mercadotech-automatic-validator
description: >
  Portero binario de MercadoTech: corre una checklist FIJA (reglas del enforcer + errores críticos
  del reviewer + lint + type-check + test, y los E2E si el stack local está arriba) y da un
  veredicto de una sola palabra — VALIDACIÓN APROBADA o VALIDACIÓN FALLIDA — sin matices ni
  "aprobado con observaciones". Úsalo al cerrar una tarea o una fase, cuando pidan "corre el
  validator", "¿esto está listo para commitear?", antes de un commit final, o cuando invoquen
  /mercadotech-automatic-validator.
---

# Automatic Validator — MercadoTech

## Para qué sirve

Es el portero: pasa o no pasa. Un solo ítem fallido hace fallar TODO el veredicto — no existe
"aprobado con observaciones". **Reporta QUÉ falló y DÓNDE; nunca corrige nada.**

## Qué NO hace

- No repite el análisis cualitativo completo del reviewer (nota /10, sugerencias) — solo absorbe
  sus errores CRÍTICOS como ítems binarios.
- No pondera ni da nota — es sí/no por ítem, y AND lógico entre todos para el veredicto final.
- No sugiere ubicaciones alternativas con matices — solo repite qué regla del enforcer se violó.
- No corrige código ni edita nada.

## Checklist fija (todas obligatorias)

```
- [ ] mercadotech-architecture-enforcer sobre los archivos tocados → APROBAR en cada uno
- [ ] mercadotech-code-reviewer sobre los archivos tocados → CERO errores críticos
      (los importantes y las sugerencias NO hacen fallar el validator)
- [ ] `npm run lint` (desde mercadotech/) → exit 0
- [ ] `npm run type-check` (desde mercadotech/) → exit 0
- [ ] `npm run type-check` dentro de `mcp/`, si el cambio tocó `mcp/` → exit 0
- [ ] `npm run build` (desde mercadotech/) → exit 0
- [ ] `npm run test` (desde mercadotech/) → exit 0 — OBLIGATORIO (Fase 6.8: ya no es N/A)
- [ ] `npm run test:e2e` (desde mercadotech/) → exit 0
      — SOLO si `supabase status` reporta el stack local arriba; si está apagado, N/A (no cuenta
        como fallo, pero decláralo siempre — nunca lo omitas en silencio)
```

## Cómo correr cada ítem

* Los dos primeros ítems se resuelven invocando las otras dos Skills sobre el mismo diff/archivos
  — no se reimplementan sus reglas aquí.
* Los comandos de terminal se corren de verdad (no se asume el resultado): pegar la salida real,
  no un resumen.
* Antes de decidir si `npm run test:e2e` aplica, correr `supabase status` de verdad — verde =
  obligatorio; apagado o con error = N/A, declarado explícitamente en el reporte.

## Formato de salida

```
## Validación automática — MercadoTech

- [x] architecture-enforcer: APROBAR (0 archivos rechazados)
- [ ] code-reviewer: 1 error crítico en `services/order.service.ts:42`
- [x] npm run lint: exit 0
- [x] npm run type-check: exit 0
- [x] npm run build: exit 0
- [ ] npm run test: 1 test roto en `lib/utils.test.ts`
- [ ] npm run test:e2e: N/A (`supabase status` apagado)

### Ítems fallidos
- code-reviewer: `services/order.service.ts:42` — <resumen del error crítico, pegar el hallazgo>
- npm run test: `lib/utils.test.ts` — <pegar el nombre del test y el mensaje real de la aserción>

## VALIDACIÓN FALLIDA
```

o, si todos los ítems obligatorios pasan:

```
## VALIDACIÓN APROBADA
```

La última línea del informe es siempre, literalmente, `## VALIDACIÓN APROBADA` o
`## VALIDACIÓN FALLIDA` — en mayúsculas, sin texto adicional en esa línea, para que sea
reconocible por quien solo busca el veredicto.

## Ante contradicción

`CLAUDE.md` gana sobre cualquier regla que esta Skill herede de las otras dos.
