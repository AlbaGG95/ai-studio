# Demo rápida (2 min) — AI Studio (Web + API)

## 1) Arranque
- `corepack pnpm install` (si aún no se instaló)
- `corepack pnpm --filter web dev` (elige puerto libre empezando en 3000)
- Nota: si 3000 está ocupado, el dev server auto-salta al siguiente; para forzar uno, usa `PORT=3001 corepack pnpm --filter web dev`

## 2) Playground (/playground)
Pasos para cada caso: pegar Title/Prompt → **Generate** → estados “Interpretando/Validando/Generando/Listo” → **Play**.

- A) Idle RPG  
  Title: `Dark Mythology`  
  Prompt: `"Idle RPG AFK con héroes, progreso por stages, tono oscuro y épico."`  
  Resultado: template idle_rpg_afk, carga AFK UI con mapa/batallas auto.
- B) Trivia  
  Title: `Trivia Anime`  
  Prompt: `"Juego de preguntas tipo quiz con categorías, tono casual."`  
  Resultado: template trivia_basic, pantalla de preguntas con score y restart.
- C) Runner  
  Title: `Neon Runner`  
  Prompt: `"Endless runner con obstáculos, velocidad progresiva, estética neón."`  
  Resultado: template runner_endless, canvas con salto (click/Space), score y restart.
- D) Tower Defense  
  Title: `Citadel Siege`  
  Prompt: `"Tower defense con oleadas, torres mejorables y defensa de base."`  
  Resultado: template tower_defense_basic, grilla clickeable, botón Iniciar oleada, vidas base.
- E) Match-3  
  Title: `Crystal Garden`  
  Prompt: `"Puzzle match-3 con combos y score."`  
  Resultado: template match3_basic → placeholder seguro (sin runtime) indicando que la plantilla está pendiente.

## 3) API (/api/generate)
- Ejemplo OK:  
  ```bash
  curl -X POST http://localhost:3000/api/generate \
    -H "Content-Type: application/json" \
    -d '{"title":"Dark Mythology","prompt":"Idle RPG AFK con héroes"}'
  ```
  Devuelve `projectId`, `spec` (GameSpec v1.0) y `templateId` elegido.
- Error 400 (input vacío o JSON inválido): `{ "error": "title or prompt required" }`
- Error 429 (rate limit 30/min/IP): `{ "error": "Too many requests" }`

## 4) Checklist pre-demo
- `corepack pnpm --filter web lint` ✓
- `corepack pnpm --filter web build` ✓
- `node scripts/smoke.mjs` ✓ (8 prompts)
- Limpiar estado local si procede: borrar `data/` generada o usar seeds en `examples/`
