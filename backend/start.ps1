# Start PromptArena backend (Windows)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$python = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
$pip = Join-Path $PSScriptRoot ".venv\Scripts\pip.exe"
$flask = Join-Path $PSScriptRoot ".venv\Scripts\flask.exe"

if (-not (Test-Path $python)) {
    Write-Host "Creating virtual environment..."
    python -m venv .venv
}

Write-Host "Installing dependencies..."
& $pip install -r requirements.txt

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example"
}

if (-not (Test-Path "promptarena.db")) {
    Write-Host "Initializing database..."
    & $flask --app app:create_app init-db
}

Write-Host "Starting server at http://localhost:5000"
& $python run.py
