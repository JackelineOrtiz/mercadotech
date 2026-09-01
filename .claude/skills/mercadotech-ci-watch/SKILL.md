---
name: mercadotech-ci-watch
description: >
  Vigía del CI real de MercadoTech: después de un `git push`, hace polling de GitHub Actions para
  el commit recién pusheado (via `gh`) y reporta el resultado real — verde con los jobs y su
  duración, o rojo con el extracto real del log del step que falló — en vez de invocar `gh run
  watch` a mano y leer la salida cruda. Úsalo inmediatamente después de cualquier `git push` a una
  rama con CI, cuando pidan "revisá el CI", "¿pasó el pipeline?", "esperá el resultado real de
  GitHub Actions", o cuando invoquen /mercadotech-ci-watch.
---

# CI Watch — MercadoTech

## Para qué sirve

Es el que se queda mirando el semáforo para no tener que estarlo mirando vos. Después de un push,
hoy hay que acordarse de invocar `gh run list`/`gh run watch` a mano, esperar, y leer la salida
cruda para encontrar el step que falló. Esta Skill hace ese polling y devuelve un reporte corto:
verde con los jobs reales, o rojo con el extracto exacto del log que importa — nunca "revisá vos
el link".

## Qué NO hace

- No dispara el `git push` — corre DESPUÉS de uno que ya se hizo (por vos o por Claude en el hilo
  principal).
- No decide si un fallo de CI bloquea o no un commit ya hecho — eso ya pasó, el commit ya está en
  el remoto. Si el CI da rojo, el trabajo que sigue (revertir, arreglar, o documentar que es deuda
  pre-existente — ver `mercadotech-governance-orchestrator`) lo decide un humano o Claude en el
  hilo principal con este reporte como insumo.
- No corre los checks localmente ni los reimplementa — eso es `npm run lint`/`type-check`/`build`/
  `test`/`test:e2e` de siempre, o `mercadotech-automatic-validator` si se quiere ANTES de pushear.
  Esta Skill solo mira el resultado real que ya corrió GitHub Actions.
- No reintenta un run fallido por sí sola (`gh run rerun`) — eso es una decisión del humano o de
  Claude en el hilo principal, nunca automática.

## Flujo

1. **Identificar el run real**: `gh run list --limit 3` (o `--branch <rama>` si no es `main`) para
   encontrar el run del commit recién pusheado — nunca asumir que es el primero de la lista sin
   mirar el SHA/mensaje. Si no aparece todavía (recién pusheado, GitHub tarda unos segundos en
   encolarlo), esperar unos segundos y volver a listar — no inventar un `run id`.

2. **Monitorear de verdad**: `gh run watch <run-id> --exit-status`. Este comando bloquea hasta que
   el run termina — si tarda más de lo razonable para una sola llamada de herramienta, lanzarlo en
   segundo plano (background) en vez de quedarse esperando sin hacer nada útil mientras tanto, y
   revisar el resultado cuando avise que terminó.

3. **Si termina en éxito**: reportar cada job real (nombre + duración) tal cual los devuelve
   `gh run watch`, sin resumir de más — el usuario ya vio ejemplos de "job en Xs" en corridas
   anteriores y espera ese nivel de detalle real, no un simple "pasó".

4. **Si termina en fallo**: identificar el/los job(s) y step(s) reales que fallaron desde la salida
   de `gh run watch`, y traer el extracto real del log de ESE step específico (`gh run view
   <run-id> --log-failed`, o `gh run view --job <job-id> --log` si hace falta más contexto) — nunca
   inventar ni resumir el mensaje de error, pegar el texto real.

5. **Nunca declarar éxito sin haber corrido el comando real** — ni asumir que "seguramente pasó"
   porque los checks locales ya habían pasado antes de pushear. El veredicto de esta Skill es
   siempre el de GitHub Actions, nunca una inferencia.

## Formato de salida

```
## CI Watch — <rama>, commit <sha corto> "<primera línea del mensaje>"

Run: <url o run-id>

[si éxito]
✓ CI · <run-id> — success

JOBS
✓ <job 1> en <duración>
✓ <job 2> en <duración>
...

[si fallo]
✗ CI · <run-id> — failure

JOBS
✓ <job que sí pasó> en <duración>
✗ <job que falló> en <duración>
  ✗ <step real que falló>

### Log real del step fallido
```
<extracto real, no resumido, de gh run view --log-failed>
```
```

## Ante contradicción

`CLAUDE.md` gana. El pipeline real de CI (jobs, steps, qué navegadores corre Playwright, etc.) es
el que está definido en `.github/workflows/` — si esta Skill describe algo distinto a lo que ese
archivo dice, releerlo antes de reportar; puede haber cambiado.
