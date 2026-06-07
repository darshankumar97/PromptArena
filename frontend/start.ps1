# Start PromptArena frontend (Windows)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.local.example" ".env.local"
    Write-Host "Created .env.local from .env.local.example"
}

$needsInstall = (-not (Test-Path "node_modules\next\package.json")) `
  -or (-not (Test-Path "node_modules\enhanced-resolve\package.json")) `
  -or (-not (Test-Path "node_modules\@tailwindcss\postcss\package.json"))

if ($needsInstall) {
    Write-Host "Installing npm dependencies (including dev)..."
    npm install --include=dev
}

$env:NODE_ENV = "development"
Write-Host "Starting frontend at http://localhost:3000"
npm run dev
