# ============================================================
#  bootstrap.ps1  Windows PowerShell 5.1 / PowerShell 7+
#  Run once after cloning:  .\scripts\bootstrap.ps1
#  Run as normal user — no administrator rights required.
# ============================================================
$ErrorActionPreference = "Stop"
function Step  { param($n,$t) Write-Host "`n  $n  $t" -ForegroundColor Cyan }
function Ok    { param($t)    Write-Host "    [OK] $t" -ForegroundColor Green }
function Warn  { param($t)    Write-Host "    [!!] $t" -ForegroundColor Yellow }
function Fail  { param($t)    Write-Host "    [XX] $t" -ForegroundColor Red; exit 1 }

$RepoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $RepoRoot

Write-Host @"
`n  ╔════════════════════════════════════════╗
  ║  IT Automation Platform  Bootstrap     ║
  ║  Windows / PowerShell                  ║
  ║  Yvan Martineau                        ║
  ╚════════════════════════════════════════╝`n
"@ -ForegroundColor White

# 1. Prerequisites
Step "1/8" "Prerequisites"
@("git","docker","python","node","npm") | ForEach-Object {
  if (Get-Command $_ -ErrorAction SilentlyContinue) { Ok "$_ found" }
  else { Warn "$_ not found - install before proceeding" }
}
$pyVer = python --version 2>&1
if ($pyVer -match "3\.1[2-9]") { Ok "Python 3.12+ detected" }
else { Warn "Python < 3.12 detected ($pyVer) - upgrade recommended" }
$nodeVer = (node -v 2>$null) -replace "v",""
if ([int]($nodeVer.Split(".")[0]) -ge 20) { Ok "Node.js >= 20" }
else { Warn "Node.js < 20 ($nodeVer) - upgrade recommended" }

# 2. Git init
Step "2/8" "Git repository"
if (Test-Path ".git") { Ok "Already a git repo" }
else { git init; Ok "git init done" }
try { git checkout -b main 2>$null } catch {}
try { git checkout main 2>$null } catch {}

# 3. Git hooks
Step "3/8" "Git hooks"
git config core.hooksPath .git-hooks
# On Windows git uses the scripts directly from core.hooksPath
# chmod not needed - git for Windows handles execute bits
Ok "core.hooksPath set to .git-hooks"

# 4. .env
Step "4/8" "Environment file"
if (Test-Path ".env") {
  Warn ".env already exists - not overwriting"
} else {
  Copy-Item ".env.example" ".env"
  Ok ".env created from .env.example - fill in all REPLACE_ values"
}

# 5. JWT secret
Step "5/8" "JWT secret"
$envContent = Get-Content ".env" -Raw
if ($envContent -match "REPLACE_WITH_64_HEX_CHARS") {
  $key = python -c "import secrets; print(secrets.token_hex(32))"
  $envContent = $envContent -replace "REPLACE_WITH_64_HEX_CHARS", $key
  Set-Content ".env" $envContent -NoNewline
  Ok "JWT_SECRET_KEY auto-generated and written to .env"
} else {
  Ok "JWT_SECRET_KEY already set"
}

# 6. Python venv via uv
Step "6/8" "Python virtual environment (backend using uv)"
if (Test-Path "backend\.venv") {
  Ok "Virtual environment already exists"
} else {
  # uv automatically downloads, isolates, and targets 3.12 flawlessly
  uv venv backend\.venv --python 3.12
  Ok "Virtual environment created at backend\.venv via uv (Python 3.12)"
}
# Blazing fast sync directly into the virtual environment
uv pip compile backend\requirements.txt -o backend\requirements.txt --quiet
uv pip sync backend\requirements.txt --python backend\.venv\Scripts\python.exe --quiet
Ok "Backend dependencies installed securely via uv"

# 7. Frontend
Step "7/8" "Frontend (npm install)"
if (Test-Path "frontend\node_modules") {
  Ok "node_modules already present"
} else {
  Push-Location frontend
  npm install --silent
  Pop-Location
  Ok "Frontend dependencies installed"
}

# 8. Initial commit
Step "8/8" "Initial commit"
git add .
try {
  git commit --no-verify -m "chore(init): bootstrap project 1 workspace"
  Ok "Initial commit created"
} catch {
  Warn "Commit skipped (nothing new or already committed)"
}

Write-Host "`n  Bootstrap complete!`n" -ForegroundColor Green
Write-Host "  Next steps:"
Write-Host "  1.  Fill in .env  (DATABASE_URL, GRAPH_*, GMAIL_*, N8N_*)"
Write-Host "  2.  cd infra ; docker compose up -d"
Write-Host "  3.  backend\.venv\Scripts\activate"
Write-Host "  4.  cd frontend ; npm run dev"
Write-Host "  5.  Open http://localhost:5173  and  http://localhost:8000/docs`n"
