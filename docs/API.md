# Public API

## POST /api/generate
Genera un proyecto a partir de un título + prompt, elige plantilla y devuelve la ruta sugerida para jugar.

- **Request**
  - URL: `/api/generate`
  - Method: `POST`
  - Body (JSON):
    ```json
    {
      "title": "Dark Mythology",
      "prompt": "Idle RPG AFK con héroes y stages."
    }
    ```
- **Response (200)**
  ```json
  {
    "projectId": "proj-123",
    "spec": { "...": "GameSpec v1.0" },
    "templateId": "idle_rpg_afk",
    "route": "/afk?configId=fantasy_dark"
  }
  ```
- **Errors**
  - `400` JSON inválido, inputs demasiado largos o falta `title/prompt`: `{ "error": "title or prompt required" }`
  - `429` rate limit: `{ "error": "Too many requests" }`
  - `500` error inesperado: `{ "error": "Unexpected error" }`

## Ejemplos
- Idle RPG
  ```bash
  curl -X POST http://localhost:3000/api/generate \
    -H "Content-Type: application/json" \
    -d '{"title":"Dark Mythology","prompt":"Idle RPG AFK con heroes"}'
  ```
- Trivia
  ```bash
  curl -X POST http://localhost:3000/api/generate \
    -H "Content-Type: application/json" \
    -d '{"title":"Trivia Anime","prompt":"quiz casual de anime"}'
  ```
- Runner
  ```bash
  curl -X POST http://localhost:3000/api/generate \
    -H "Content-Type: application/json" \
    -d '{"title":"Neon Runner","prompt":"endless runner neon con obstaculos"}'
  ```

## Notas
- CORS: habilitado para cualquier origen (`Access-Control-Allow-Origin: *`).
- Rate limit: 30 solicitudes/minuto por IP (in-memory).
- Persistencia: guarda `schemaVersion`, `spec`, `templateId` y ruta sugerida en `data/projects/`.
- Validación: `title` máx. 120 caracteres, `prompt` máx. 6000; si el template falla se usa un placeholder seguro.
