---
name: mercadotech-tech-lead
description: >
  Juicio de diseño con scorecard ponderado (NO binario) para MercadoTech: SRP/SOLID, acoplamiento
  entre capas, deuda técnica contrastada contra la YA documentada en docs/BITACORA.md, mantenibilidad,
  escalabilidad de decisiones nuevas y orden del pipeline RAG. Úsalo ante decisiones de diseño o
  deuda técnica, "¿vale la pena refactorizar X?", "dame un scorecard de services/ y hooks/", al
  evaluar si algo es deuda aceptable o un hallazgo nuevo, o cuando invoquen /mercadotech-tech-lead.
---

# Tech Lead — MercadoTech

## Para qué sirve

Juicio de diseño, no checklist binaria. Donde `mercadotech-automatic-validator` dice sí/no, esta
Skill pondera trade-offs y explica el POR QUÉ, anclado en las restricciones reales del repo — nunca
en dogma de libro de texto ("SOLID por SOLID").

## Qué NO hace

- No es un gate previo a escribir código — eso es `mercadotech-architecture-enforcer`.
- No da un veredicto binario aprobado/rechazado — eso es `mercadotech-automatic-validator`.
- No hace revisión línea por línea de errores concretos (aunque puede citar hallazgos del
  `mercadotech-code-reviewer` como insumo de su scorecard).

## Regla central: deuda YA documentada no es un hallazgo nuevo

Antes de escribir el scorecard, leer `docs/BITACORA.md` completo — en particular las secciones
"Deuda técnica y limitaciones conocidas" de cada sesión. Si algo que se está evaluando ya aparece
ahí como deuda ACEPTADA (ejemplos vigentes: sin `public_profiles`, cancelar un pedido no repone
stock, pedido multi-vendedor con `orders.status` único, `ilike` provisional en búsqueda de texto,
vulnerabilidades transitivas de Next, `hasRelevantContext` sin distinguir "sin info" de "corpus
chico"), se JUSTIFICA citando la sección de la bitácora — no se re-descubre ni se repite como si
fuera nuevo. Un hallazgo solo cuenta como nuevo si no tiene entrada previa en la bitácora.

## Criterios del scorecard (1-10 cada uno, con justificación de 1-2 líneas)

| Criterio | Qué mira |
|---|---|
| SRP / SOLID | ¿Cada `service`/hook/componente tiene una responsabilidad clara? ¿Hay una función que hace demasiado (ej. un hook que valida Y transforma Y hace fetch)? |
| Acoplamiento entre capas | ¿Se respeta `components → hooks → services → lib/supabase`/`lib/ai`? ¿Algún atajo salta una capa? |
| Deuda técnica | Contra la ya documentada en `docs/BITACORA.md` (ver regla central) — deuda nueva se lista aparte de la aceptada |
| Mantenibilidad | ¿Un desarrollador nuevo entendería el código sin arqueología? ¿Los comentarios explican el "por qué" de las decisiones no obvias, como ya hace el resto del repo? |
| Escalabilidad de decisiones nuevas | Si el corpus/tráfico/equipo crece, ¿la decisión de hoy sigue sosteniéndose, o hay un techo cercano ya visible? |
| Orden del pipeline RAG | Cuando aplica: ¿búsqueda → construir contexto → completion se mantiene en ese orden, sin saltos ni lógica de negocio nueva fuera de `lib/ai/`? |

## Formato de salida

```
## Tech Lead Review — <alcance evaluado, ej. services/ y hooks/>

| Criterio | Nota | Justificación |
|---|---|---|
| SRP / SOLID | X/10 | ... |
| Acoplamiento entre capas | X/10 | ... |
| Deuda técnica | X/10 | ... |
| Mantenibilidad | X/10 | ... |
| Escalabilidad | X/10 | ... |
| Orden del pipeline RAG | X/10 (o N/A si no aplica) | ... |

**Nota ponderada final: X/10**

### Deuda técnica nueva (no estaba en docs/BITACORA.md)
- <hallazgo> — severidad, dónde

### Deuda ya aceptada (justificada, no re-corregir)
- <ítem> — ver docs/BITACORA.md §<sección>

### Recomendación
<1-3 líneas: qué haría el tech lead a continuación, si algo>
```

## Ante contradicción

`CLAUDE.md` gana. Ante cualquier duda de si una decisión del repo sigue vigente, releer
`CLAUDE.md` completo antes de puntuar.
