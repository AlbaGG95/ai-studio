# AI Studio MVP

A local-first AI studio for creating and previewing AI-generated games. Build, iterate, and test games entirely on your machine.

## Canonical Docs
- `docs/ai-studio-platform.md` (arquitectura y pipelines)
- `docs/contracts.md` (contratos ejecutables y validacion)

## Features

- ✅ Create game projects from templates
- ✅ Live game preview in the browser
- ✅ Local filesystem storage (no database needed)
- ✅ Chat-like UI for game modifications
- ✅ Built-in Idle RPG game template with save/load
- ✅ Automatic file application and preview refresh

## Tech Stack

- **Frontend**: Next.js 14 + TypeScript + React
- **Backend**: Fastify + Node.js
- **Storage**: Local filesystem + browser localStorage
- **Package Manager**: pnpm workspaces

## Project Structure

```
ai-studio/
├── apps/
│   ├── web/              # Next.js 3000
│   └── api/              # Fastify 4000
├── packages/
│   ├── core/             # Shared types & schemas
│   └── templates/
│       └── idle-rpg/     # Idle RPG game template
├── workspaces/           # Generated projects (git-ignored)
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

## Prerequisites

- **Node.js** 18.0.0 or higher (includes Corepack)

### Install Node.js on Windows

1. Download from https://nodejs.org/ (LTS version recommended)
2. Run the installer and follow the wizard
3. Restart your computer or close all PowerShell windows
4. Verify installation in a new PowerShell window:
   ```powershell
   node --version
   npm --version
   ```

> **Note**: Node.js 16.9+ includes Corepack, which automatically manages pnpm for you. No separate pnpm installation is needed.

## Quick Start (Windows PowerShell)

### One Command to Rule Them All

Simply run this single command from the project root:

```powershell
cd "c:\Users\albag\OneDrive\Desktop\CURSO INTERNET MID\ai-studio"
.\run-dev.ps1
```

This script will:

- ✅ Verify Node.js is installed
- ✅ Set up Corepack and activate pnpm
- ✅ Install dependencies (if needed)
- ✅ Free ports 3000, 4000-4003 (kill any stuck node processes)
- ✅ Start both API and Web servers

That's it! No PATH manipulation, no manual steps.

---

### Expected Output:

```
✓ Node.js is installed: v25.2.1
ℹ Setting up Corepack and pnpm...
✓ Corepack enabled
✓ pnpm@latest prepared and activated
✓ pnpm is ready: v10.26.2
✓ Dependencies are up to date - skipping install
ℹ Checking for processes on ports 3000, 4000-4003...
✓ All ports are free
ℹ Starting AI Studio development servers...
  Web:  http://localhost:3000
  API:  http://localhost:4000 (or 4001-4003 if port in use)

🚀 Starting AI Studio development servers...
📦 Starting API server...
⏳ Waiting for API to be ready...
✓ API ready on http://localhost:4000
🌐 Starting Web server...
✅ All servers started!
```

---

### Manual Setup (If run-dev.ps1 fails or you need more control)

**Step 1: Navigate to the project**

```powershell
cd "c:\Users\albag\OneDrive\Desktop\CURSO INTERNET MID\ai-studio"
```

**Step 2: Set up Corepack and pnpm manually**

```powershell
corepack enable
corepack prepare pnpm@latest --activate
corepack pnpm --version
```

**Step 3: Install dependencies**

```powershell
corepack pnpm install
```

**Step 4: Start development servers**

```powershell
corepack pnpm dev
```

---

### Advanced Options for run-dev.ps1

```powershell
# Skip dependency installation step
.\run-dev.ps1 -SkipInstall

# Skip port cleanup (don't kill stuck processes)
.\run-dev.ps1 -SkipPortCleanup

# Combine both
.\run-dev.ps1 -SkipInstall -SkipPortCleanup
```

Expected output:

```
🚀 Starting AI Studio development servers...
📦 Starting API server...
⏳ Waiting for API to be ready...
✓ API ready on http://localhost:4000  (or 4001, 4002, 4003 if port in use)
🌐 Starting Web server...
✅ All servers started!
   Web:  http://localhost:3000
   API:  http://localhost:4000
```

### Step 4: Verify everything works

1. **Open the web app**:

   - Navigate to http://localhost:3000 in your browser
   - You should see the AI Studio home page

2. **Test API connectivity**:

   - The web app will automatically discover the API port via `/api/ports` endpoint
   - You can verify manually:

   ```powershell
   # Check the ports file
   Get-Content ".ai-studio\ports.json"

   # Test API endpoint
   $port = (Get-Content ".ai-studio\ports.json" | ConvertFrom-Json).apiPort
   Invoke-RestMethod -Uri "http://localhost:$port/health"  # Should return {"status":"ok"}
   Invoke-RestMethod -Uri "http://localhost:$port/projects"  # Should return []
   ```

3. **Create a test project**:

   - Click "New Project" button
   - Enter a project name (e.g., "Test Game")
   - Verify the project appears in the list
   - Click the project to see the game preview

4. **Test preview and API calls**:
   - The game preview (right panel) should load from `/preview/{projectId}/`
   - Click "Apply Demo Change" to test file modifications

### Troubleshooting

#### Port Already in Use (EADDRINUSE)

If you see `EADDRINUSE: address already in use`, a previous process is still holding the port.

**Quick fix**:

```powershell
# Find process using port 4000 (or 3000 for web)
netstat -ano | findstr ":4000"
netstat -ano | findstr ":3000"

# Kill the process (replace PID with the number from netstat output)
taskkill /PID <PID> /F

# Then retry pnpm dev
pnpm dev
```

**If stuck**: Restart your PowerShell window and retry.

#### API Port Changed

The API automatically finds the first available port in 4000-4003. If it uses port 4001 or higher:

- The web app automatically discovers the correct port via `/api/ports`
- No manual changes needed
- Check `.ai-studio/ports.json` to see which port was selected

#### Web App Doesn't Connect to API

1. Verify both servers are running (check console output)
2. Check if `.ai-studio/ports.json` exists:
   ```powershell
   Get-Content ".ai-studio\ports.json"
   ```
3. Manually test API health:
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:4000/health"
   ```

If you need to set the API URL manually, create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4001
```

### Alternative: Manual Script Execution

If `pnpm dev` fails, you can start servers individually:

```powershell
# Terminal 1: Start API
$env:PATH = "C:\Program Files\nodejs;C:\Users\albag\AppData\Roaming\npm;$env:PATH"
pnpm dev:api

# Terminal 2: Start Web (in a new PowerShell window)
$env:PATH = "C:\Program Files\nodejs;C:\Users\albag\AppData\Roaming\npm;$env:PATH"
pnpm dev:web
```

## Usage

### Create a Project

1. Open http://localhost:3000 in your browser
2. Click "New Project"
3. Enter a project name and press "Create"
4. Click the project card to open it

### View Game Preview

- The game preview appears in the right panel
- It's a live idle RPG game with:
  - Gold counter
  - Damage per second (DPS)
  - Level progression
  - Upgrade system
  - Automatic save/load via localStorage

### Modify the Game

- Use the "Apply Demo Change" button to test file updates
- Write files to `workspaces/<project-id>/src/`
- The API automatically re-copies the template to `build/` and reloads the iframe

### Chat Interface (Local Only)

- Type messages in the left panel
- Messages stay in local state (no AI backend yet)
- Responses are simulated for demo purposes

## API Endpoints

### Projects

**POST /projects**

```json
{
  "name": "My Game"
}
```

Returns: `{ id, name, createdAt }`

**GET /projects**
Returns: Array of all projects

### Apply Changes

**POST /projects/:id/apply**

```json
{
  "files": [
    { "path": "src/feature.js", "content": "..." },
    { "path": "src/data.json", "content": "..." }
  ]
}
```

Returns: `{ writtenFiles: [...] }`

Security: Prevents path traversal attacks

### Preview

**GET /preview/:id/**
Serves static files from `workspaces/:id/build/`

**GET /preview/:id/index.html**
Serves the game HTML file

## Data Storage

- **Projects**: `workspaces/<project-id>/` directories
- **Metadata**: `workspaces/<project-id>/metadata.json`
- **Game State**: Browser localStorage (idle-rpg)
- **Modified Files**: `workspaces/<project-id>/src/`
- **Game Build**: `workspaces/<project-id>/build/` (auto-managed)

## Development Scripts

```powershell
# Run both web and API concurrently
corepack pnpm dev

# Run web app only
pnpm dev:web

# Run API only
pnpm dev:api

# Build for production
pnpm build

# Lint code
pnpm lint
```
> Dev server: `pnpm --filter web dev` now auto-picks a free port starting at `3000`. Set `PORT=4000` (or similar) to force a port if you want to align with other services.

## File Structure Details

### Web App (Next.js)

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout
│   │   ├── globals.css        # Global styles
│   │   ├── page.tsx           # Project list
│   │   ├── page.module.css
│   │   └── projects/
│   │       └── [id]/
│   │           ├── page.tsx   # Project detail (chat + preview)
│   │           └── page.module.css
│   └── components/            # Reusable components
├── next.config.js
├── tsconfig.json
└── package.json
```

### API Server (Fastify)

```
apps/api/
├── src/
│   └── server.ts              # Main server + all endpoints
├── tsconfig.json
└── package.json
```

### Templates

```
packages/templates/idle-rpg/
├── index.html                 # Game HTML
├── game.js                    # Game logic
└── package.json
```

### Shared Code

```
packages/core/
├── index.ts                   # Type definitions
└── package.json
```

## Game Features (Idle RPG Template)

The included idle RPG game features:

- **Clicking**: Each click generates gold
- **DPS System**: Passive income every second
- **Upgrades**:
  - Gold Production (increases per-click rewards)
  - DPS (increases passive income)
- **Progression**: Level up every 10 kills
- **Persistence**: Automatic save via localStorage
- **Responsive UI**: Works on desktop and mobile

To try it:

1. Create a project
2. Open the preview panel
3. Click "ATTACK" to earn gold
4. Upgrade your stats
5. Refresh the page — your progress is saved!

## Additional Documentation

- `docs/ai-studio-platform.md` - Plataforma canonica
- `docs/contracts.md` - Contratos ejecutables
- `docs/archive/` - Documentacion historica (no canonica)
- `.env.example` - Environment variables template

## Windows Specifics

### Path Handling

The application uses Node.js path utilities that work cross-platform. When creating new game files, all paths are normalized to use forward slashes (`/`) internally.

### Port Management

If you encounter "port already in use" errors on Windows:

```powershell
# Find process using port 3000
$process = Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess
Stop-Process -Id $process.Id -Force

# Find process using port 4000
$process = Get-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess
Stop-Process -Id $process.Id -Force
```

### PowerShell Execution Policy

If the setup script won't run, you may need to allow PowerShell script execution:

```powershell
# Allow scripts for current user only
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Verify
Get-ExecutionPolicy
```

## Troubleshooting

### Port Already in Use

If port 3000 or 4000 is already in use, see the Port Management section above.

### CORS Issues

The API is configured to accept requests from `http://localhost:3000`. If you change the port, update the CORS origin in [apps/api/src/server.ts](apps/api/src/server.ts#L20).

### Dependencies Not Installing

```powershell
# Clear pnpm cache
pnpm store prune

# Clear node_modules
pnpm clean

# Reinstall
pnpm install
```

### Module Not Found Errors

Ensure you're running `pnpm install` from the root directory:

```powershell
cd "c:\Users\albag\OneDrive\Desktop\CURSO INTERNET MID\ai-studio"
pnpm install
```

## Architecture Notes

### Single-User Local Design

- All state is stored in the file system
- No authentication or authorization
- Perfect for local development and demos
- Can be extended with a database later

### Template System

- Templates are stored in `packages/templates/`
- When you create a project, the template is copied to `workspaces/<id>/build/`
- You can modify files in `workspaces/<id>/src/`
- The build directory is regenerated on each apply

### Path Security

- All file paths are sanitized
- Path traversal attacks are blocked
- Files can only be written under `workspaces/<id>/src/`

## Future Extensions

To add features:

1. **Real AI Integration**: Replace simulated chat responses with an AI API
2. **Additional Templates**: Add more game templates in `packages/templates/`
3. **Database**: Replace filesystem with PostgreSQL/MongoDB
4. **Authentication**: Add user accounts and multi-user support
5. **Code Editor**: Add an in-browser code editor for live editing
6. **Version Control**: Track file changes and support undo/redo
7. **Export**: Package projects as standalone HTML games

## License

MIT - Free to use and modify

## Support

For issues, check:

1. Node.js version: `node --version` (should be 18+)
2. pnpm version: `pnpm --version` (should be 8+)
3. Port availability: `netstat -ano | findstr :3000` and `:4000`
4. API logs: Check the terminal running `pnpm dev:api`

---

**Built with ❤️ for game creators**
