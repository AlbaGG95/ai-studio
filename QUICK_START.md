# Quick Reference Guide

## Installation & Startup (ONE COMMAND)

### Run the setup script

```powershell
cd "c:\Users\albag\OneDrive\Desktop\CURSO INTERNET MID\ai-studio"
.\run-dev.ps1
```

That's it! The script will:

- ✅ Check Node.js installation
- ✅ Enable Corepack
- ✅ Prepare and activate pnpm
- ✅ Install dependencies (if needed)
- ✅ Kill any stuck processes on ports 3000, 4000-4003
- ✅ Start both API and Web servers

**Expected output**:

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
   Web:  http://localhost:3000
   API:  http://localhost:4000
```

### If run-dev.ps1 Won't Execute

PowerShell might block scripts by default. Run this once to allow:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then retry: `.\run-dev.ps1`

---

## Verification Steps

### 1. Check web server is running

Open browser: http://localhost:3000

Expected: AI Studio home page with "New Project" button

### 2. Verify API port discovery

```powershell
# View the port file
Get-Content ".ai-studio\ports.json"

# Expected output:
# {
#   "apiPort": 4000,
#   "apiUrl": "http://localhost:4000"
# }
```

### 3. Test API endpoints

```powershell
# Get API port (adjust if 4001, 4002, etc.)
$port = (Get-Content ".ai-studio\ports.json" | ConvertFrom-Json).apiPort

# Test health endpoint
Invoke-RestMethod -Uri "http://localhost:$port/health"
# Expected: {"status":"ok"}

# List projects
Invoke-RestMethod -Uri "http://localhost:$port/projects"
# Expected: [] (empty array on first run)
```

### 4. Create a test project

```powershell
$port = (Get-Content ".ai-studio\ports.json" | ConvertFrom-Json).apiPort

# Create a project via API
$response = Invoke-RestMethod -Uri "http://localhost:$port/projects" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"name":"Test Game"}'

$response | ConvertTo-Json
```

Or in browser:

1. Go to http://localhost:3000
2. Click "New Project"
3. Enter "Test Game"
4. Press "Create"
5. Verify project appears in list

### 5. Test game preview

1. Click the "Test Game" project
2. Game preview should load on the right
3. Click "ATTACK" button in the game
4. Verify gold and stats increase

### 6. Test API communication

1. On the project page, click "Apply Demo Change"
2. Should show success message
3. Iframe preview should still be visible

## URLs

| Service      | URL                             | Purpose                  |
| ------------ | ------------------------------- | ------------------------ |
| Web App      | http://localhost:3000           | Create & manage projects |
| API          | http://localhost:4000\*         | Game backend             |
| Health Check | http://localhost:4000\*/health  | Verify API is running    |
| Ports Info   | http://localhost:3000/api/ports | Discover actual API port |

\*API port may be 4001, 4002, or 4003 if 4000 is in use

## File Locations

| What          | Where                          | Purpose                        |
| ------------- | ------------------------------ | ------------------------------ |
| Web Code      | `apps/web/src/app/`            | Next.js pages & components     |
| API Code      | `apps/api/src/server.ts`       | Fastify server                 |
| Game Template | `packages/templates/idle-rpg/` | Idle RPG game files            |
| Projects      | `workspaces/`                  | Auto-generated project folders |
| Shared Types  | `packages/core/index.ts`       | TypeScript interfaces          |

## Common Commands

```powershell
# Start development
pnpm dev

# Start only web app
pnpm dev:web

# Start only API
pnpm dev:api

# Build for production
pnpm build

# Check for lint/type errors
pnpm lint

# Clean and reinstall
pnpm clean && pnpm install
```

## Key Endpoints (API)

### Create Project

```bash
curl -X POST http://localhost:4000/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"My Game"}'
```

### List Projects

```bash
curl http://localhost:4000/projects
```

### Apply Changes

```bash
curl -X POST http://localhost:4000/projects/{ID}/apply \
  -H "Content-Type: application/json" \
  -d '{"files":[{"path":"src/test.txt","content":"hello"}]}'
```

### Preview Game

```
http://localhost:4000/preview/{ID}/
```

## Game Features

The included Idle RPG has:

- **Click to earn**: 10 gold per click
- **Passive income**: Earn gold per second (DPS)
- **Upgrades**: Boost gold production or DPS
- **Progression**: Level up every 10 kills
- **Auto-save**: Progress saved to localStorage
- **Cost scaling**: Upgrades cost 1.15x more each level

## Troubleshooting

### Port Already in Use (EADDRINUSE)

**Problem**: `Error: listen EADDRINUSE: address already in use 0.0.0.0:4000`

**Causes**: A previous server process is still running.

**Solutions**:

**Option 1: Kill the process using the port**

```powershell
# Find process using port 4000
netstat -ano | findstr ":4000"

# Output example: TCP  0.0.0.0:4000  0.0.0.0:0  LISTENING  12345
# The PID is 12345

# Kill the process
taskkill /PID 12345 /F

# Retry pnpm dev
pnpm dev
```

For port 3000 (web):

```powershell
netstat -ano | findstr ":3000"
taskkill /PID <PID> /F
```

**Option 2: Restart PowerShell**

Close all PowerShell windows and open a new one, then retry `pnpm dev`.

**Option 3: Check API port fallback**

The API automatically tries ports 4000, 4001, 4002, 4003 in sequence. If 4000 is in use, it uses the next available:

```powershell
# Check which port was actually used
Get-Content ".ai-studio\ports.json"

# If it shows 4001 or higher, web app auto-discovers it - no manual changes needed!
```

### API Port Changes (4000 → 4001+)

**Problem**: You kill a process on 4000, but now the API uses 4001.

**No action needed!** The web app automatically discovers the port:

1. `.ai-studio/ports.json` is updated with the new port
2. Web app reads `/api/ports` endpoint at startup
3. All requests are routed to the correct port

Verify:

```powershell
# Check the file
Get-Content ".ai-studio\ports.json"

# Web should connect automatically
# If it doesn't, check browser console (F12) for errors
```

### Web App Can't Connect to API

**Problem**: Web shows "Failed to load projects" or similar errors.

**Debugging steps**:

1. **Verify both servers are running**:

   ```powershell
   # Should show listening ports
   netstat -ano | findstr ":3000\|:4000"
   ```

2. **Check the ports file exists**:

   ```powershell
   Get-Content ".ai-studio\ports.json" -ErrorAction Stop
   ```

3. **Test API health directly**:

   ```powershell
   $port = (Get-Content ".ai-studio\ports.json" | ConvertFrom-Json).apiPort
   Invoke-RestMethod -Uri "http://localhost:$port/health"
   # Should return: {"status":"ok"}
   ```

4. **Set manual API URL** (temporary override):
   Create `apps/web/.env.local`:

   ```env
   NEXT_PUBLIC_API_URL=http://localhost:4001
   ```

   Then restart web with `pnpm dev:web`.

5. **Check browser console**:
   - Press F12 in browser
   - Click Console tab
   - Look for errors about fetch failures
   - Note the actual URL being requested

### Scripts Won't Run / pnpm Not Found

**Problem**: `pnpm: The term 'pnpm' is not recognized`

**Solution**:

```powershell
# Add Node.js paths to PATH for this session
$env:PATH = "C:\Program Files\nodejs;C:\Users\albag\AppData\Roaming\npm;$env:PATH"

# Verify pnpm is now available
pnpm --version

# Retry command
pnpm dev
```

This temporary PATH change only affects the current PowerShell window and doesn't modify your system.

### Dependencies Not Installing

**Problem**: `pnpm install` fails or hangs

**Solutions**:

```powershell
# Clear pnpm cache
pnpm store prune

# Reinstall
pnpm install

# If still stuck, try with verbose output
pnpm install --verbose
```

### TypeScript Compilation Errors

**Problem**: `error TS1149` or similar during startup

**Solutions**:

```powershell
# Make sure you're in the root directory
cd "c:\Users\albag\OneDrive\Desktop\CURSO INTERNET MID\ai-studio"

# Reinstall node_modules
pnpm install

# Check for remaining TypeScript errors
pnpm lint

# If specific to web or api, check their tsconfig.json
# Files: apps/web/tsconfig.json, apps/api/tsconfig.json
```

### Game Preview Doesn't Load

**Problem**: Iframe shows blank or "Not found" error

**Debugging**:

1. Check if a project exists:

   ```powershell
   # List workspaces directory
   Get-ChildItem "workspaces\" -Directory
   ```

2. Verify the build directory exists:

   ```powershell
   # Check if build folder was created
   Get-ChildItem "workspaces\<PROJECT_ID>\build\" -File
   ```

3. Check API logs:

   - Look at terminal running `pnpm dev`
   - Search for error messages related to the project ID

4. Manually test preview endpoint:

   ```powershell
   $port = (Get-Content ".ai-studio\ports.json" | ConvertFrom-Json).apiPort
   $projectId = (Get-ChildItem "workspaces\" -Directory)[0].Name

   Invoke-WebRequest -Uri "http://localhost:$port/preview/$projectId/" -PassThru
   ```

## Workspace Structure

```
ai-studio/
├── apps/web          ← Next.js web app (port 3000)
├── apps/api          ← Fastify API server (port 4000)
├── packages/core     ← Shared TypeScript types
├── packages/templates/idle-rpg  ← Game template
└── workspaces/       ← Generated projects (auto-created)
```

## File Types

| Extension | Usage                |
| --------- | -------------------- |
| `.ts`     | TypeScript files     |
| `.tsx`    | React components     |
| `.json`   | Configuration & data |
| `.css`    | Styling              |
| `.html`   | Game markup          |
| `.js`     | Game logic           |

## Key Files to Know

| File                                      | Purpose                         |
| ----------------------------------------- | ------------------------------- |
| `apps/api/src/server.ts`                  | All API endpoints (POST/GET)    |
| `apps/web/src/app/page.tsx`               | Home page (projects list)       |
| `apps/web/src/app/projects/[id]/page.tsx` | Project detail (chat + preview) |
| `packages/templates/idle-rpg/index.html`  | Game UI                         |
| `packages/templates/idle-rpg/game.js`     | Game logic                      |
| `packages/core/index.ts`                  | TypeScript types                |

## Project Creation Flow

1. User enters project name → clicks "Create"
2. API generates UUID and creates `workspaces/{UUID}/`
3. API copies idle-rpg template to `build/`
4. Metadata saved to `metadata.json`
5. Project appears in list
6. User clicks project → opens chat + preview
7. Preview loads game from `http://localhost:4000/preview/{UUID}/`

## File Application Flow

1. User clicks "Apply Demo Change"
2. Files written to `workspaces/{UUID}/src/`
3. API re-copies template to `build/`
4. Frontend reloads iframe
5. Game preview updates

## Environment Variables

Create `.env.local` (optional):

```
NEXT_PUBLIC_API_URL=http://localhost:4000
API_PORT=4000
API_HOST=0.0.0.0
```

Default values used if not set.

## Development Tips

### View API Logs

Check the terminal running `pnpm dev:api` to see request logs.

### Clear Browser Cache

If game preview looks stale:

1. Right-click iframe
2. "Reload frame" or
3. Press F5 in VS Code browser

### Check File System

Generated projects in: `workspaces/` folder

- Each UUID has its own directory
- `src/` contains user files
- `build/` contains the playable game
- `metadata.json` has project info

### Debug Game State

Open browser DevTools (F12):

1. Open Console
2. Type: `localStorage.getItem('idleRpgState')`
3. See saved game state as JSON

## Security Reminders

✅ **Do**: Write files to `src/` folder
❌ **Don't**: Try to traverse parent directories (blocked)
✅ **Do**: Use `/preview/{ID}/` for game access
❌ **Don't**: Access files outside project's build folder

## Common Workflows

### Play a Game

1. Go to http://localhost:3000
2. Create a project
3. Click the project card
4. Click "ATTACK" in the preview
5. Upgrade your stats
6. Refresh page - progress is saved!

### Test File Updates

1. Create a project
2. Click "Apply Demo Change"
3. See the change reflected in API response
4. Check `workspaces/{ID}/src/demo.txt`

### Create Multiple Projects

Just repeat the process - each gets a unique UUID and separate game save.

## When to Check Documentation

| Question                     | File              |
| ---------------------------- | ----------------- |
| "How do I get started?"      | README.md         |
| "What API endpoints exist?"  | API.md            |
| "How is the code organized?" | ARCHITECTURE.md   |
| "Why did you choose X tech?" | IMPLEMENTATION.md |
| "How do I test the API?"     | TESTING.md        |

## Performance Expectations

| Operation             | Time        |
| --------------------- | ----------- |
| Cold start (pnpm dev) | 3-5 seconds |
| Create project        | <100ms      |
| List projects         | <50ms       |
| Apply changes         | <200ms      |
| Game load in preview  | <100ms      |
| Game tick interval    | 1 second    |

## Version Information

- Node.js: 18+
- pnpm: 8+
- Next.js: 14
- Fastify: 4
- TypeScript: 5
- React: 18

## Support Resources

1. **API Reference**: `API.md`
2. **Architecture Diagram**: `ARCHITECTURE.md`
3. **Full Documentation**: `README.md`
4. **Implementation Details**: `IMPLEMENTATION.md`
5. **Testing Guide**: `TESTING.md`

## Next Steps

After getting familiar with the MVP:

1. **Explore the Code**

   - Look at `apps/api/src/server.ts` to understand endpoints
   - Check `apps/web/src/app/page.tsx` for UI components

2. **Modify the Game**

   - Edit `packages/templates/idle-rpg/game.js`
   - Restart API to test changes

3. **Add More Features**

   - Create new API endpoints in `server.ts`
   - Add new Next.js pages
   - Create new game templates in `packages/templates/`

4. **Deploy**
   - Use provided Dockerfiles
   - Deploy web to Vercel, API to Railway/Render
   - Update CORS origin to production URL

---

**Remember**: The entire AI Studio runs locally. You control all data. Start with `pnpm dev` and have fun! 🎮
