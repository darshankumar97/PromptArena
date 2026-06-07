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

if ($env:USE_RQ_QUEUE -eq "1" -and $env:REDIS_URL) {
    Write-Host "Starting RQ worker (USE_RQ_QUEUE=1)..."
    Start-Process -FilePath $python -ArgumentList "worker_process.py" -WorkingDirectory $PSScriptRoot -WindowStyle Normal
}

Write-Host "Starting server at http://localhost:5000"
Write-Host "Generation jobs: in-process thread pool (set USE_RQ_QUEUE=1 to use Redis/RQ worker)"
& $python run.py
