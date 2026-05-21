# Start PromptArena frontend (Windows)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.local.example" ".env.local"
    Write-Host "Created .env.local from .env.local.example"
}

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies..."
    npm install
}

$env:NODE_ENV = "development"
Write-Host "Starting frontend at http://localhost:3000"
npm run dev
