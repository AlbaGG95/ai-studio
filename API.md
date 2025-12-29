# API Documentation

## Base URL

- Development: `http://localhost:4000`

## Endpoints

### Create Project

**POST** `/projects`

Create a new game project.

**Request:**

```json
{
  "name": "My Awesome Game"
}
```

**Response (201):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Awesome Game",
  "createdAt": "2024-12-27T10:30:00.000Z"
}
```

**Errors:**

- 400: Invalid project name

---

### List Projects

**GET** `/projects`

Retrieve all projects.

**Response (200):**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Awesome Game",
    "createdAt": "2024-12-27T10:30:00.000Z"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Another Game",
    "createdAt": "2024-12-27T11:00:00.000Z"
  }
]
```

---

### Apply Changes

**POST** `/projects/:id/apply`

Write files to a project and regenerate the preview.

**Parameters:**

- `id` (path): Project UUID

**Request:**

```json
{
  "files": [
    {
      "path": "src/custom.js",
      "content": "console.log('Hello, World!');"
    },
    {
      "path": "src/config.json",
      "content": "{\"version\": \"1.0\"}"
    }
  ]
}
```

**Response (200):**

```json
{
  "writtenFiles": ["src/custom.js", "src/config.json"]
}
```

**Errors:**

- 400: Invalid files array or path traversal attempt
- 404: Project not found
- 500: Failed to write files

**Security:**

- Path traversal attacks are prevented
- Files can only be written to `workspaces/<id>/src/`
- After writing, the template is re-copied to `build/`

---

### Get Game Preview

**GET** `/preview/:id/`

Serve the game preview (index.html).

**Parameters:**

- `id` (path): Project UUID

**Response (200):**

- HTML content of the game

**Errors:**

- 404: Project or file not found
- 403: Access denied

---

### Get Preview File

**GET** `/preview/:id/:path*`

Serve any file from the project's build directory.

**Parameters:**

- `id` (path): Project UUID
- `:path*` (path): File path (e.g., `game.js`, `assets/image.png`)

**Response (200):**

- File content with appropriate content-type

**Errors:**

- 404: Project or file not found
- 403: Access denied

**Examples:**

- `GET /preview/550e8400-e29b-41d4-a716-446655440000/` → index.html
- `GET /preview/550e8400-e29b-41d4-a716-446655440000/game.js` → game.js
- `GET /preview/550e8400-e29b-41d4-a716-446655440000/assets/image.png` → image.png

---

### Health Check

**GET** `/health`

Check if the API is running.

**Response (200):**

```json
{
  "status": "ok"
}
```

---

## File Structure

When you create a project with ID `550e8400-e29b-41d4-a716-446655440000`, the following directory structure is created:

```
workspaces/
└── 550e8400-e29b-41d4-a716-446655440000/
    ├── metadata.json           # Project info
    ├── src/                    # User-modified files
    ├── spec/                   # (Reserved for future use)
    └── build/                  # Generated game (auto-managed)
        ├── index.html
        └── game.js
```

---

## CORS

The API accepts requests from:

- `http://localhost:3000` (configured for development)

To allow other origins, modify the CORS configuration in `apps/api/src/server.ts`.

---

## Error Handling

All errors follow this format:

```json
{
  "error": "Detailed error message"
}
```

---

## Example Usage (cURL)

### Create a project

```bash
curl -X POST http://localhost:4000/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"My Game"}'
```

### List projects

```bash
curl http://localhost:4000/projects
```

### Apply changes

```bash
curl -X POST http://localhost:4000/projects/550e8400-e29b-41d4-a716-446655440000/apply \
  -H "Content-Type: application/json" \
  -d '{"files":[{"path":"src/test.txt","content":"Hello"}]}'
```

### Get preview

```bash
curl http://localhost:4000/preview/550e8400-e29b-41d4-a716-446655440000/
```

---

## Example Usage (JavaScript/TypeScript)

```typescript
const API_URL = "http://localhost:4000";

// Create project
const createRes = await fetch(`${API_URL}/projects`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "My Game" }),
});
const project = await createRes.json();
console.log("Project ID:", project.id);

// List projects
const listRes = await fetch(`${API_URL}/projects`);
const projects = await listRes.json();
console.log("Projects:", projects);

// Apply changes
const applyRes = await fetch(`${API_URL}/projects/${project.id}/apply`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    files: [{ path: "src/custom.js", content: 'console.log("test");' }],
  }),
});
const result = await applyRes.json();
console.log("Written files:", result.writtenFiles);
```
