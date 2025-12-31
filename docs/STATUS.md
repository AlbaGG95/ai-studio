# AI Studio – estado inicial (feature/afk-polish-v1)

## Cómo ejecutar
- Requisitos: Node 18+ con Corepack. Si `pnpm` no está en PATH, activa con `corepack enable` y `corepack prepare pnpm@latest --activate`.
- Instalar dependencias (si falta): `corepack pnpm install`.
- Desarrollo full-stack: `corepack pnpm dev` (usa `scripts/dev.mjs` para levantar API y Web). Manual: `corepack pnpm --filter api dev` y `corepack pnpm --filter web dev`.
- Build: `corepack pnpm --filter api build` (OK). `corepack pnpm --filter web build` falla hoy por errores de TS/ESLint (ver abajo).
- Smoke test de generación: `corepack pnpm test:smoke` (pasa; genera un proyecto ejemplo en `data/projects/`).

## Qué funciona ahora
- Stack: Next.js 14 + React/TypeScript (`apps/web`), Fastify API (`apps/api`), paquete compartido `@ai-studio/core` con schemas y utilidades, Phaser para la escena de juego.
- UI inicial en `apps/web/src/app/page.tsx`: crea/genera proyectos vía `/api/generate` y redirige a preview si el backend responde.
- API build (`apps/api`) y core build (`packages/core`) completan usando `corepack pnpm --filter ... run <task>`. El smoke test crea un proyecto idle de ejemplo (`afk-test-1srnl4`).

## Problemas detectados
- Lint: `corepack pnpm --filter web lint` se detiene porque `next lint` pide configurar ESLint interactivo. Falta `.eslintrc` preconfigurado; hay que inicializarlo o añadirlo manualmente.
- Build web: `corepack pnpm --filter web build` falla por TS en `apps/web/src/app/play/BattleCanvas.tsx:157` (`Property 'focusFloor' does not exist on type 'BattleScene'`). Además, Node advierte que `next.config.js` se reinterpreta como ES module; añadir `"type": "module"` en `apps/web/package.json` eliminaría el warning.
- Herramientas: los scripts que llaman `pnpm` asumen Corepack activado; sin ello aparece `pnpm no se reconoce`.

## Qué falta para llegar a “segunda grabación” (UI completa + loop idle + pulido)
- Desbloquear pipeline: añadir config ESLint de Next y corregir el typo/prop faltante en `BattleScene` para que `next build` y `next lint` pasen.
- Completar layout/UX de juego idle en `apps/web/src/app/play` (canvas + HUD), asegurando loop AFK estable y carga de datos generados.
- Pulido: manejo de errores de generación/preview, rutas de proyectos (`/projects`, `/play`), y QA básica (tests rápidos o checks de escena) una vez el build pase.
