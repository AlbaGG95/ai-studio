# QA E2E – Generador multi-juego

## Comandos verificados
- `corepack pnpm --filter web dev` → ❌ puerto 3000 en uso (EADDRINUSE). Reintentar tras liberar puerto.
- `corepack pnpm --filter web lint` → ✅
- `corepack pnpm --filter web build` → ✅

## Casos probados (scripts/e2e-sim.mjs)
- **Idle RPG** — title `Dark Mythology`, prompt idle épico → `idle_rpg_afk`, ruta `/afk?configId=fantasy_dark`.
- **Trivia** — title `Trivia Anime`, prompt quiz casual → `trivia_basic`, ruta `/play?templateId=trivia_basic`.
- **Runner** — title `Neon Runner`, prompt endless runner → `runner_endless` (ruta placeholder `/play?templateId=runner_endless&fallback=placeholder_basic...`).
- **Ambiguo** — title `Mi juego`, prompt genérico → fallback `idle_rpg_afk`, ruta `/afk?configId=scifi_clean`.

## Decisiones de fallback / hardening
- Selector de plantillas siempre retorna algo; si no hay match, usa `placeholder_basic`.
- Runner usa placeholder jugable hasta que exista runtime real.
- `/api/generate` valida JSON y responde 400 para inputs inválidos; incluye `schemaVersion` en persistencia.
- UI de Home captura errores y muestra banner sin romper el layout.
