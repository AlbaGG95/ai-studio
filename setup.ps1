#!/usr/bin/env pwsh

Write-Host "AI Studio Setup Script" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""

# 1) Verify Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed or not found in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js LTS (>=16.9, recommended 18+) from https://nodejs.org/ and then re-open PowerShell." -ForegroundColor White
    exit 1
}
try { Write-Host "node -v -> $(node --version)" -ForegroundColor Gray } catch {}
try { Write-Host "where.exe node ->" -ForegroundColor Gray; & where.exe node 2>$null | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray } } catch {}

# 2) Verify Corepack
Write-Host "" -ForegroundColor Cyan
Write-Host "Checking Corepack..." -ForegroundColor Yellow
if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Corepack is not available in this Node.js installation." -ForegroundColor Red
    Write-Host "Corepack ships with modern Node.js (LTS). Install Node.js LTS and re-open PowerShell." -ForegroundColor White
    exit 1
}
try { Write-Host "corepack --version -> $(corepack --version)" -ForegroundColor Gray } catch {}
try { Write-Host "where.exe corepack ->" -ForegroundColor Gray; & where.exe corepack 2>$null | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray } } catch {}

# 3) Enable Corepack and activate pnpm via Corepack
Write-Host "" -ForegroundColor Cyan
Write-Host "Enabling Corepack (safe) and preparing pnpm@latest..." -ForegroundColor Yellow
corepack enable
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ corepack enable returned non-zero. Continuing, but consider running 'corepack enable' manually." -ForegroundColor Yellow
}

corepack prepare pnpm@latest --activate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ corepack prepare pnpm@latest failed." -ForegroundColor Red
    Write-Host "Try: close all PowerShell windows, open a new one, then run:" -ForegroundColor White
    Write-Host "  corepack enable" -ForegroundColor White
    Write-Host "  corepack prepare pnpm@latest --activate" -ForegroundColor White
    exit 1
}

# 4) Diagnostics for pnpm availability via corepack
Write-Host "" -ForegroundColor Cyan
Write-Host "Verifying pnpm via Corepack..." -ForegroundColor Yellow
try {
    $v = corepack pnpm -v 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $v) {
        Write-Host "❌ 'corepack pnpm -v' failed or returned empty." -ForegroundColor Red
        Write-Host "Please re-run the prepare step or restart PowerShell." -ForegroundColor White
        exit 1
    }
    Write-Host "✅ corepack pnpm -> $v" -ForegroundColor Green
} catch {
    Write-Host "❌ Error running 'corepack pnpm -v'" -ForegroundColor Red
    exit 1
}
try { Write-Host "where.exe pnpm ->" -ForegroundColor Gray; & where.exe pnpm 2>$null | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray } } catch {}

# 5) Install dependencies (use corepack pnpm)
Write-Host "" -ForegroundColor Cyan
Write-Host "Installing dependencies (this may take a minute)..." -ForegroundColor Yellow
corepack pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 'corepack pnpm install' failed." -ForegroundColor Red
    Write-Host "Check the output above for errors. You can try running:" -ForegroundColor White
    Write-Host "  corepack pnpm install" -ForegroundColor White
    exit 1
}

Write-Host "" -ForegroundColor Cyan
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host "To start the development servers run:" -ForegroundColor Cyan
Write-Host "  corepack pnpm dev" -ForegroundColor White
Write-Host "Web: http://localhost:3000" -ForegroundColor White
Write-Host "API: http://localhost:4000" -ForegroundColor White
#!/usr/bin/env pwsh

Write-Host "AI Studio Setup Script" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""

#!/usr/bin/env pwsh

Write-Host "AI Studio Setup Script" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""

 # Check Node.js
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed or not available in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js 18+ from https://nodejs.org/ and reopen PowerShell." -ForegroundColor White
    exit 1
}
$nodeVersion = node --version 2>$null
Write-Host "✅ Node.js $nodeVersion found" -ForegroundColor Green

# Corepack + pnpm activation (strict Corepack flow)
Write-Host ""
Write-Host "Checking Corepack availability..." -ForegroundColor Yellow
if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Corepack is not available on this Node.js installation." -ForegroundColor Red
    Write-Host "Corepack is included with modern Node.js (LTS). Please install Node.js LTS (or >=16.9) from https://nodejs.org/ and reopen PowerShell." -ForegroundColor White
    exit 1
}

$cpVersion = corepack --version 2>$null
Write-Host "✅ Corepack found ($cpVersion)" -ForegroundColor Green

Write-Host "Enabling Corepack..." -ForegroundColor Yellow
corepack enable
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  corepack enable returned non-zero (continuing)" -ForegroundColor Yellow
}

Write-Host "Preparing pnpm via Corepack (pnpm@latest)..." -ForegroundColor Yellow
corepack prepare pnpm@latest --activate
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  corepack prepare pnpm@latest returned non-zero" -ForegroundColor Yellow
}

# Verify pnpm is now available
Write-Host "Verifying pnpm is available..." -ForegroundColor Yellow
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ pnpm is not available after Corepack activation." -ForegroundColor Red
    Write-Host "Try closing all PowerShell windows and opening a new one, then run this script again." -ForegroundColor White
    exit 1
}

$pnpmVersion = pnpm --version 2>$null
Write-Host "✅ pnpm $pnpmVersion available" -ForegroundColor Green

# Install dependencies
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
pnpm install

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Setup complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "To start the development servers, run:" -ForegroundColor Cyan
    Write-Host "  corepack pnpm dev" -ForegroundColor White
    Write-Host ""
    Write-Host "The application will be available at:" -ForegroundColor Cyan
    Write-Host "  Web: http://localhost:3000" -ForegroundColor White
    Write-Host "  API: http://localhost:4000" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Installation failed" -ForegroundColor Red
    exit 1
}
