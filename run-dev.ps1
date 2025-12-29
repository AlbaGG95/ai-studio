# run-dev.ps1
# AI Studio - Development bootstrap (Windows PowerShell 5.1 / PowerShell 7)
# Uses Corepack if available; otherwise falls back to pnpm from PATH or standard locations.

$ErrorActionPreference = "Stop"

Write-Host "AI Studio - starting development environment" -ForegroundColor Cyan

# 1) Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node not found. Install Node LTS." -ForegroundColor Red
  exit 1
}

node -v

Write-Host "--- Diagnostics ---" -ForegroundColor Cyan
where.exe node 2>$null

# 2) Locate pnpm
$pnpmCmd = $null
$useCorepack = $false

if (Get-Command corepack -ErrorAction SilentlyContinue) {
  Write-Host "Found: corepack" -ForegroundColor Green
  $useCorepack = $true
  $pnpmCmd = 'corepack pnpm'
}
elseif (Get-Command pnpm -ErrorAction SilentlyContinue) {
  Write-Host "Found: pnpm (in PATH)" -ForegroundColor Green
  $pnpmCmd = 'pnpm'
}
else {
  $wherePnpm = & where.exe pnpm 2>$null
  if ($wherePnpm) {
    Write-Host "Found: pnpm via where.exe" -ForegroundColor Green
    $first = $wherePnpm -split "\r?\n" | Select-Object -First 1
    $pnpmCmd = $first.Trim()
  }
  else {
    $candidates = @(
      "$env:ProgramFiles\nodejs\pnpm.cmd",
      "$env:ProgramFiles(x86)\nodejs\pnpm.cmd",
      "$env:APPDATA\npm\pnpm.cmd",
      "$env:LOCALAPPDATA\Programs\nodejs\pnpm.cmd"
    )
    foreach ($p in $candidates) {
      if (Test-Path $p) {
        Write-Host ("Found: pnpm at " + $p) -ForegroundColor Green
        $pnpmCmd = $p
        break
      }
    }
  }
}

if (-not $pnpmCmd) {
  Write-Host "pnpm not found. Fix: run 'npm i -g pnpm' or install Node LTS and restart VS Code." -ForegroundColor Red
  exit 1
}

# 3) Verify pnpm and show diagnostics
if ($useCorepack) {
  where.exe corepack 2>$null
  Write-Host "Using: corepack pnpm" -ForegroundColor Cyan
  corepack enable
  corepack prepare pnpm@latest --activate
  corepack pnpm -v
}
else {
  where.exe pnpm 2>$null
  Write-Host ("Using pnpm: " + $pnpmCmd) -ForegroundColor Cyan
  & $pnpmCmd -v 2>$null
}

# 4) Install dependencies if needed
if (-not (Test-Path node_modules)) {
  Write-Host "Installing dependencies..." -ForegroundColor Yellow
  if ($useCorepack) {
    corepack pnpm install
  }
  else {
    & $pnpmCmd install
  }
}
else {
  Write-Host "Dependencies already installed." -ForegroundColor Green
}

# 5) Start dev
Write-Host "Starting dev" -ForegroundColor Cyan
if ($useCorepack) {
  corepack pnpm dev
}
else {
  & $pnpmCmd dev
}

exit $LASTEXITCODE
