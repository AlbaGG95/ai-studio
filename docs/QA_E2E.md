# QA E2E – Generador multi-juego

## Comandos verificados
- `corepack pnpm --filter web lint` ✓
- `corepack pnpm --filter web build` ✓
- `node scripts/smoke.mjs` ✓ (8 prompts pasan)
- `PORT=3001 corepack pnpm --filter web dev` ✓ (dev.mjs auto-detecta puerto libre)

## Casos (runtime en `/play?projectId=…`)
| Title | Template | Runtime | Resultado |
| --- | --- | --- | --- |
| Dark Mythology | idle_rpg_afk | AFK idle RPG | OK en /play con mapa/batalla |
| Trivia Anime | trivia_basic | Preguntas (score + restart) | OK |
| Neon Runner | runner_endless | Runner canvas | OK (jump/score/restart) |
| Citadel Siege | tower_defense_basic | Grid TD | OK (oleada + vidas base) |
| Crystal Garden | match3_basic | Placeholder | OK (placeholder seguro sin crash) |

## Decisiones de fallback / hardening
- `/api/generate` y `/api/projects` usan `ProjectRecord` estable (schemaVersion, templateId, config) y migran registros viejos; si faltan campos se recalcula con `selectTemplate`.
- `/play` enruta por `templateId`; todos los enlaces Jugar/Preview abren `/play?projectId=…`; `/preview/:id` redirige a play.
- `BattleCanvas` tiene fallback/log cuando Phaser falla (sin TypeError).
- Selector de plantillas siempre retorna algo (placeholder si el spec es inválido); `match3/clicker/platformer` usan placeholder hasta tener runtime.
- Dev server: busca puerto libre desde 3000 (se puede forzar `PORT`); datos generados (`data/`, `.data/`) fuera de git, seeds en `examples/`.
- Healthcheck: `GET /api/health` devuelve `{ ok: true, time, version }`.
- Cliente usa rutas relativas `/api/*` (sin hosts hardcodeados); en Home se muestra banner si la API no responde en el puerto actual.

## Flujos DEV
- **Reset (DEV)**: POST `/api/dev/reset` (solo dev) borra proyectos en disco; botones "Reset (DEV)" en `/projects` y `/playground` limpian también localStorage (keys ai-studio/projects/state) y recargan. Script: `pnpm dev:reset` (requiere web dev arriba).
- **Run E2E: Trivia (DEV)** en `/playground` (solo dev): ejecuta reset, rellena título/prompt de trivia, llama `/api/generate` y abre `/play?projectId=...&debug=1`.
- **Overlay debug (/play?debug=1)** en dev muestra projectId, title, spec.type, templateId, runtime, route, schemaVersion y timestamp. Para Trivia debe verse: `spec.type=trivia`, `templateId=trivia_basic`, `runtime=TriviaGame`.
