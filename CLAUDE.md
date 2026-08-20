# MercadoTech — Guía para Claude Code

Marketplace de productos tecnológicos con soporte por agentes de voz. Ver
`README.md` para el plan maestro del proyecto y el mapa de sesiones.

## Estado

- Sesión 1: repo inicializado (esta sesión).
- Sesión 2 (en curso): Fase 2.1 — estructura del proyecto Next.js + Supabase.

## Estructura del repositorio

- `README.md`, `MercadoTech_sesion*.md`: especificaciones de cada sesión del
  curso. Son la fuente de verdad de lo que hay que construir — léelas antes
  de generar código.
- `docs/`: documentación técnica generada durante el proyecto (arquitectura,
  decisiones de diseño).
- `mercadotech/`: el proyecto Next.js (se crea en la Fase 2.1).

## Principio rector

Separación estricta de capas: `components/` (presentación pura) →
`hooks/` (estado de cliente) → `services/` (lógica de negocio, cliente
Supabase inyectable) → `lib/supabase/` (clientes). La UI nunca importa
`lib/ai/`, `lib/voice/` ni el cliente `admin`. Ver el detalle completo en
`README.md`.

## Comandos

_Se completan en la Fase 2.1 al crear el proyecto Next.js._
