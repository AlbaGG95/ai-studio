# QA E2E – Generador multi-juego

## Comandos verificados
- `corepack pnpm --filter web lint` ✓
- `corepack pnpm --filter web build` ✓
- `PORT=3001 corepack pnpm --filter web dev` ✓ (dev.mjs auto-detecta puerto libre)
- `node scripts/smoke.mjs` ✓ (8 prompts pasan)

## Casos probados
- Idle RPG: `Dark Mythology` → template `idle_rpg_afk`, ruta `/afk?configId=fantasy_dark`.
- Trivia: `Trivia Anime` → template `trivia_basic`, ruta `/play?templateId=trivia_basic`.
- Runner: `Neon Runner` → template `runner_endless`, ruta `/play?templateId=runner_endless&title=Neon%20Runner`.
- Tower Defense: `Citadel Siege` → template `tower_defense_basic`, ruta `/play?templateId=tower_defense_basic`.
- Match3: `Crystal Garden` → template `match3_basic`, ruta `/play?templateId=match3_basic` (placeholder seguro hasta tener runtime).
- Ambiguo/Vacío: cae en `idle_rpg_afk`, ruta `/afk?configId=scifi_clean`.
- Prompt muy largo: sigue generando (`runner_endless`) sin romper.

## Decisiones de fallback / hardening
- `/api/generate` valida JSON, límite de longitud (`title` 120, `prompt` 6000), y usa template placeholder si un build falla; errores de entrada responden 400, rate limit 429.
- Selector de plantillas siempre retorna algo (placeholder si el spec es inválido); en `/play`, `match3_basic`, `clicker_basic` y `platformer_basic` muestran placeholder en vez de fallar.
- El dev server (`pnpm --filter web dev`) elige un puerto libre a partir del 3000; se puede forzar con `PORT`.
- Estados persistidos (`data/`) quedan fuera de git; ejemplos o seeds deben ir en `examples/`.
