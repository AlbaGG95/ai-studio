# AI Studio – estado (feature/afk-polish-v1)

## Cómo ejecutar
- Requisitos: Node 18+ con Corepack. Si `pnpm` no está en PATH, activa con `corepack enable` y `corepack prepare pnpm@latest --activate`.
- Instalar dependencias: `corepack pnpm install`.
- Desarrollo full-stack: `corepack pnpm dev` (script `scripts/dev.mjs`). Manual: `corepack pnpm --filter api dev` y `corepack pnpm --filter web dev`.
- Build: `corepack pnpm --filter api build` ✅, `corepack pnpm --filter web build` ✅.
- Smoke test de generación: `corepack pnpm test:smoke` ✅ (genera proyectos en `data/projects/`).

## Qué funciona ahora
- Stack: Next.js 14 + React/TypeScript (`apps/web`), Fastify API (`apps/api`), paquete compartido `@ai-studio/core`, motor Phaser para canvas de batalla.
- UI base en `apps/web/src/app/page.tsx` para crear/generar proyectos; vista de juego en `/play`; UI AFK en `/afk`.
- Builds de API/Core/Web pasan; lint de web pasa.

## Estado de estabilidad (31/12/2025)
- Comandos verificados:
  - `corepack pnpm --filter web lint`
  - `corepack pnpm --filter web build`
- Fixes aplicados:
  - Añadida `.eslintrc.json` y deps (`eslint`, `eslint-config-next`) para evitar el prompt de Next.
  - Corregido tipo faltante en `BattleCanvas` y dependencias de hooks; `resolution` ajustado.
  - Retratos de héroes ya no dependen de Phaser en SSR; `/play` envuelto en `Suspense` para `useSearchParams`.
  - Añadido `"type": "module"` en `apps/web/package.json` para evitar warnings de Next.

## Pendiente hacia “segunda grabación”
- Completar y pulir UX (proyectos, errores de generación, navegación) y QA básica.
