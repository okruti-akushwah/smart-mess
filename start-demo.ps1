$ErrorActionPreference = 'Stop'
$demoRoot = $PSScriptRoot
$demoPython = Join-Path $demoRoot 'backend/.runtime/Scripts/python.exe'
& $demoPython (Join-Path $demoRoot 'backend/seed_demo.py')
if ($LASTEXITCODE -ne 0) { throw 'Demo seeding failed.' }
$previousDemoDatabase = $env:DATABASE_URL
$previousDemoSecret = $env:SECRET_KEY
$env:DATABASE_URL = 'sqlite:///' + (Join-Path $demoRoot 'backend/demo.db').Replace('\','/')
$env:SECRET_KEY = 'local-demo-only-secret'
Write-Host 'Demo API uses port 8002. In another terminal, run:'
Write-Host 'cd frontend; $env:VITE_API_URL="http://127.0.0.1:8002"; npm run dev -- --host 127.0.0.1 --port 5174 --strictPort'
try {
    & $demoPython -m uvicorn app.main:app --app-dir (Join-Path $demoRoot 'backend') --host 127.0.0.1 --port 8002
} finally {
    $env:DATABASE_URL = $previousDemoDatabase
    $env:SECRET_KEY = $previousDemoSecret
}
