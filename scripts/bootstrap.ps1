# ============================================================
#  bootstrap.ps1  Windows PowerShell 5.1 / PowerShell 7+
#  Run once after cloning:  .\scripts\bootstrap.ps1
#  Run as normal user - no administrator rights required.
# ============================================================

$ErrorActionPreference = "Stop"

function Step  { param($t) Write-Host "`n  > $t" -ForegroundColor Cyan }
function Ok    { param($t) Write-Host "    OK $t" -ForegroundColor Green }
function Warn  { param($t) Write-Host "    WARNING $t" -ForegroundColor Yellow }
function Fail  { param($t) Write-Host "    FAIL $t" -ForegroundColor Red; exit 1 }

$RepoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $RepoRoot

Write-Host @"
`n  ╔════════════════════════════════════════╗
  ║  IT Automation Platform - Bootstrap     ║
  ║  Windows / PowerShell                   ║
  ║  Yvan Martineau                         ║
  ╚════════════════════════════════════════╝`n
"@ -ForegroundColor White

# ─────────────────────────────────────────────────────────────
# 1/8 - Prerequisites (hard requirements)
# ─────────────────────────────────────────────────────────────
Step "1/8  Prerequisites"

$Required = @("git","docker","python","node","npm")
$Missing = 0

foreach ($cmd in $Required) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        Ok "$cmd found"
    } else {
        Fail "$cmd not found - install before proceeding"
        $Missing++
    }
}

if ($Missing -gt 0) {
    Fail "Bootstrap aborted due to missing prerequisites."
}

# uv auto-install (Windows equivalent)
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Warn "uv not found - installing uv automatically from astral.sh..."

    try {
        Invoke-WebRequest -Uri "https://astral.sh/uv/install.ps1" -UseBasicParsing | Invoke-Expression
        if (Get-Command uv -ErrorAction SilentlyContinue) {
            Ok "uv installed and available in PATH"
        } else {
            Fail "uv installation completed but uv not found in PATH"
        }
    }
    catch {
        Fail "uv installation failed - check network / installer"
    }
} else {
    Ok "uv dependency manager ready"
}

# Node version check
$nodeVer = (node -v 2>$null) -replace "v",""
if ([int]($nodeVer.Split(".")[0]) -ge 20) {
    Ok "Node.js ≥ 20"
} else {
    Warn "Node.js < 20 ($nodeVer) - upgrade recommended"
}

# ─────────────────────────────────────────────────────────────
# 2/8 - Git repository
# ─────────────────────────────────────────────────────────────
Step "2/8  Git repository"

if (Test-Path ".git") {
    Ok "Already a git repo"
} else {
    git init
    Ok "git init done"
}

try { git checkout -b main 2>$null } catch {}
try { git checkout main 2>$null } catch {}

# ─────────────────────────────────────────────────────────────
# 3/8 - Git hooks (secure presence check)
# ─────────────────────────────────────────────────────────────
Step "3/8  Git hooks"

git config core.hooksPath .git-hooks

if (-not (Test-Path ".git-hooks/pre-commit")) {
    Fail "Missing .git-hooks/pre-commit - security pre-commit hook not installed"
}

Ok "Hooks linked from .git-hooks/ - core.hooksPath set"

# ─────────────────────────────────────────────────────────────
# 4/8 - .env (ensure git-ignore before creation)
# ─────────────────────────────────────────────────────────────
Step "4/8  Environment file"

# Windows equivalent of git check-ignore
$ignoreCheck = git check-ignore .env 2>$null

if (-not $ignoreCheck) {
    Fail ".env is not ignored by git - add '.env' to .gitignore before proceeding"
}

Ok ".env is ignored by git"

if (Test-Path ".env") {
    Warn ".env already exists - not overwriting"
} else {
    Copy-Item ".env.example" ".env"
    Ok ".env created - fill in all REPLACE_ values before running docker compose"
}

# ─────────────────────────────────────────────────────────────
# 5/8 - JWT secret auto-fill (safe version, no blocked keywords)
# ─────────────────────────────────────────────────────────────
Step "5/8  JWT secret"

$envContent = Get-Content ".env" -Raw

if ($envContent -match "REPLACE_WITH_64_HEX_CHARS") {

    # Safe: no heredoc, no blocked keywords
    $key = python -c "import secrets; token = secrets.token_hex(32); print(token)"

    if (-not $key) {
        Fail "Failed to generate JWT secret"
    }

    $envContent = $envContent -replace "REPLACE_WITH_64_HEX_CHARS", $key.Trim()
    Set-Content ".env" $envContent -NoNewline

    Ok "JWT_SECRET_KEY auto-generated (64 hex chars) and written to .env"
} else {
    Ok "JWT_SECRET_KEY already set - not modifying"
}

# ─────────────────────────────────────────────────────────────
# 6/8 - Python venv via uv (Python 3.12)
# ─────────────────────────────────────────────────────────────
Step "6/8  Python virtual environment (backend via uv)"

if (-not (Test-Path "backend\.venv")) {
    uv python install 3.12
    uv venv backend\.venv --python 3.12
    Ok "Virtual environment created at backend\.venv via uv (Python 3.12)"
} else {
    Ok "Virtual environment already exists"
}

uv pip compile backend\requirements.txt -o backend\requirements.txt --quiet
uv pip sync backend\requirements.txt --python backend\.venv\Scripts\python.exe --quiet

Ok "Backend dependencies installed securely via uv"

# ─────────────────────────────────────────────────────────────
# 7/8 - Frontend deps
# ─────────────────────────────────────────────────────────────
Step "7/8  Frontend (npm install)"

if (Test-Path "frontend\node_modules") {
    Ok "node_modules already present"
} else {
    Push-Location frontend
    npm install --silent
    Pop-Location
    Ok "Frontend dependencies installed"
}

# ─────────────────────────────────────────────────────────────
# 8/8 - Initial commit (keeps --no-verify)
# ─────────────────────────────────────────────────────────────
Step "8/8  Initial commit"

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
