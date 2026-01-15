# Demo rÇ­pida (2 min) ƒ?" AI Studio (Web + API)

## 1) Arranque
- `corepack pnpm install` (si aÇ§n no se instalÇü)
- `corepack pnpm --filter web dev` (elige puerto libre empezando en 3000)
- Nota: si 3000 estÇ­ ocupado, el dev server auto-salta al siguiente; para forzar uno, usa `PORT=3001 corepack pnpm --filter web dev`

## 2) Playground (/playground)
Pasos para cada caso: pegar Title/Prompt ƒÅ' **Generate** ƒÅ' estados ƒ?oInterpretando/Validando/Generando/Listoƒ?? ƒÅ' **Play**.

- A) Idle RPG  
  Title: `Dark Mythology`  
  Prompt: `"Idle RPG AFK con hÇ¸roes, progreso por stages, tono oscuro y Ç¸pico."`  
  Resultado: template idle_rpg_afk, carga AFK UI con mapa/batallas auto.
- B) Trivia  
  Title: `Trivia Anime`  
  Prompt: `"Juego de preguntas tipo quiz con categorÇðas, tono casual."`  
  Resultado: template trivia_basic, pantalla de preguntas con score y restart.
- C) Runner  
  Title: `Neon Runner`  
  Prompt: `"Endless runner con obstÇ­culos, velocidad progresiva, estÇ¸tica neÇün."`  
  Resultado: template runner_endless, canvas con salto (click/Space), score y restart.
- D) Tower Defense  
  Title: `Citadel Siege`  
  Prompt: `"Tower defense con oleadas, torres mejorables y defensa de base."`  
  Resultado: template tower_defense_basic, grilla clickeable, botÇün Iniciar oleada, vidas base.
- E) Match-3  
  Title: `Crystal Garden`  
  Prompt: `"Puzzle match-3 con combos y score."`  
  Resultado: template match3_basic ƒÅ' placeholder seguro (sin runtime) indicando que la plantilla estÇ­ pendiente.

## 2bis) AFK Idle RPG (vertical slice)
- Ruta `/afk`: mapa de campaña con stages 1-20 y CTA **Luchar** que abre `/afk/battle?stageId=...`.
- Ruta `/afk/heroes`: roster de 10+ hÇ¸roes únicos (sprites procedurales), activar equipo (5) y subir nivel con oro/exp/materiales.
- Ruta `/afk/battle`: renderer Phaser 5v5 con Auto ON, toggle x1/x2, barras de HP/energía, texto flotante y overlay Victoria/Derrota (Continue/Retry).
- Ruta `/afk/idle`: botín offline (cap 8h) con Claim que pasa banco a recursos e impacta la tasa idle.
- Persistencia offline-first en localStorage; ganar un stage desbloquea el siguiente y aumenta el rate idle.

## 3) API (/api/generate)
- Ejemplo OK:  
  ```bash
  curl -X POST http://localhost:3000/api/generate \
    -H "Content-Type: application/json" \
    -d '{"title":"Dark Mythology","prompt":"Idle RPG AFK con hÇ¸roes"}'
  ```
  Devuelve `projectId`, `spec` (GameSpec v1.0) y `templateId` elegido.
- Error 400 (input vacÇðo o JSON invÇ­lido): `{ "error": "title or prompt required" }`
- Error 429 (rate limit 30/min/IP): `{ "error": "Too many requests" }`

## 4) Checklist pre-demo
- `corepack pnpm --filter web lint` ƒo"
- `corepack pnpm --filter web build` ƒo"
- `node scripts/smoke.mjs` ƒo" (8 prompts)
- Limpiar estado local si procede: borrar `data/` generada o usar seeds en `examples/`
