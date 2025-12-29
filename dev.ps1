#!/usr/bin/env pwsh

# Agregar Node.js al PATH de esta sesión
$env:PATH = "C:\Program Files\nodejs;$env:PATH"

# Obtener la ruta de npm global
$npmGlobalPath = & "C:\Program Files\nodejs\npm.cmd" prefix -g 2>$null
if ($npmGlobalPath) {
    $env:PATH = "$npmGlobalPath;$env:PATH"
}

Write-Host "AI Studio Development Servers" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Verificando node..." -ForegroundColor Yellow
node --version
Write-Host ""
Write-Host "Iniciando servidores en ports 3000 (web) y 4000 (api)..." -ForegroundColor Cyan
Write-Host "Presiona Ctrl+C para detener." -ForegroundColor Yellow
Write-Host ""

# Ejecutar pnpm dev
pnpm dev
