# MercadoTech — Guía para Claude Code

Marketplace de productos tecnológicos con soporte por agentes de voz. Ver
`README.md` para el plan maestro del proyecto y el mapa de sesiones.

## Estado

- Sesión 1: repo inicializado.
- Sesión 2, Fase 2.1: proyecto Next.js 15 + estructura de carpetas + clientes
  de Supabase creados (aún sin esquema de base de datos, RLS, Storage ni
  seed — eso empieza en la Fase 2.2).

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

Todos se corren desde `mercadotech/` (el proyecto Next.js), no desde la raíz
del repo.

```bash
cd mercadotech

npm run dev        # servidor de desarrollo (http://localhost:3000)
npm run build      # build de producción
npm run start      # sirve el build de producción
npm run lint       # ESLint
npx tsc --noEmit   # chequeo de tipos sin emitir archivos
```

Antes de correr `npm run dev`, copiar `.env.example` a `.env.local` y llenar
las credenciales de Supabase.
