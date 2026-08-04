#!/usr/bin/env bash
# ============================================================
#  bootstrap.sh  macOS / Linux
#  Run once after cloning:  bash scripts/bootstrap.sh
# ============================================================
set -euo pipefail

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

step() { echo -e "\n${CYAN}${BOLD}▶ $1${RESET}"; }
ok()   { echo -e "  ${GREEN}✓${RESET} $1"; }
warn() { echo -e "  ${YELLOW}⚠${RESET} $1"; }
fail() { echo -e "  ${RED}✗${RESET} $1"; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo -e "${BOLD}\n  ╔════════════════════════════════════════╗"
echo    "  ║  IT Automation Platform — Bootstrap    ║"
echo    "  ║  Yvan Martineau                        ║"
echo -e "  ╚════════════════════════════════════════╝\n${RESET}"

# 1. Prerequisites (hard requirements)
step "1/8  Prerequisites"

REQUIRED_CMDS=(git docker python3 node npm)
MISSING=0
for cmd in "${REQUIRED_CMDS[@]}"; do
  if command -v "$cmd" &>/dev/null; then
    ok "$cmd found"
  else
    fail "$cmd not found — install before proceeding"
    MISSING=1
  fi
done

if [[ $MISSING -ne 0 ]]; then
  echo -e "${RED}${BOLD}Bootstrap aborted due to missing prerequisites.${RESET}"
  exit 1
fi

# Ensure 'uv' is installed for high-performance Python isolation (automatic, but checked)
if ! command -v uv &>/dev/null; then
  warn "uv not found — installing uv automatically from astral.sh..."
  if curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null 2>&1; then
    export PATH="$HOME/.local/bin:$PATH"
    if command -v uv &>/dev/null; then
      ok "uv installed and available in PATH"
    else
      fail "uv installation completed but uv not found in PATH"
      exit 1
    fi
  else
    fail "uv installation failed — check network / installer"
    exit 1
  fi
else
  ok "uv dependency manager ready"
fi

# Node version check
if [[ "$(node -v 2>/dev/null | grep -oE '[0-9]+' | head -1)" -ge 20 ]]; then
  ok "Node.js ≥ 20"
else
  warn "Node.js < 20 — upgrade recommended"
fi

# 2. Git init
step "2/8  Git repository"
if [[ -d ".git" ]]; then
  ok "Already a git repo"
else
  git init
  ok "git init done"
fi
git checkout -b main 2>/dev/null || git checkout main 2>/dev/null || true

# 3. Hooks (secure presence check)
step "3/8  Git hooks"
git config core.hooksPath .git-hooks

if [[ ! -f ".git-hooks/pre-commit" ]]; then
  fail "Missing .git-hooks/pre-commit — security pre-commit hook not installed"
  echo -e "${RED}${BOLD}Bootstrap aborted. Ensure hardened pre-commit is present in .git-hooks/.${RESET}"
  exit 1
fi

chmod +x .git-hooks/pre-commit .git-hooks/commit-msg 2>/dev/null || true
ok "Hooks linked from .git-hooks/ — core.hooksPath set"

# 4. .env (ensure git-ignore before creation)
step "4/8  Environment file"

if ! git check-ignore .env &>/dev/null; then
  fail ".env is not ignored by git — add '.env' to .gitignore before proceeding"
  echo -e "${RED}${BOLD}Bootstrap aborted to prevent committing secrets in .env.${RESET}"
  exit 1
fi
ok ".env is ignored by git"

if [[ -f ".env" ]]; then
  warn ".env already exists — not overwriting"
else
  cp .env.example .env
  ok ".env created — fill in all REPLACE_ values before running docker compose"
fi

# 5. JWT secret auto-fill
step "5/8  JWT secret"
if grep -q "REPLACE_WITH_64_HEX_CHARS" .env 2>/dev/null; then
  KEY=$(python3 - <<'EOF'
import secrets
token = secrets.token_hex(32)
print(token)
EOF
  )
  if [[ -z "$KEY" ]]; then
    fail "Failed to generate JWT secret"
    exit 1
  fi
  if [[ "$OSTYPE" == darwin* ]]; then
    sed -i '' "s/REPLACE_WITH_64_HEX_CHARS/$KEY/" .env
  else
    sed -i "s/REPLACE_WITH_64_HEX_CHARS/$KEY/" .env
  fi
  ok "JWT_SECRET_KEY auto-generated (64 hex chars) and written to .env"
else
  ok "JWT_SECRET_KEY already set — not modifying"
fi

# 6. Python venv (Targeting Python 3.12 explicitly)
step "6/8  Python virtual environment (backend via uv)"

# Ensure UV installs python managed runtimes in your actual HOME, not the Snap overlay in VSCode
export UV_PYTHON_INSTALL_DIR="$HOME/.local/share/uv/python"

if [[ ! -d "backend/.venv" ]]; then
  uv python install 3.12
  uv venv backend/.venv --python 3.12 --quiet
fi

uv pip compile backend/requirements.txt -o backend/requirements.txt --quiet 2>/dev/null || true
uv pip sync backend/requirements.txt --python backend/.venv/bin/python --quiet
ok "Backend deps installed using isolated Python 3.12 (venv at backend/.venv)"

# 7. Frontend deps
step "7/8  Frontend (npm install)"
if [[ -d "frontend/node_modules" ]]; then
  ok "node_modules already present"
else
  (cd frontend && npm install --silent)
  ok "Frontend deps installed"
fi

# 8. Initial commit (keeps --no-verify)
step "8/8  Initial commit"
git add .
git commit --no-verify \
  -m "chore(init): bootstrap project 1 workspace" \
  && ok "Initial commit created" || warn "Commit skipped (nothing new or already committed)"

echo -e "\n${GREEN}${BOLD}Bootstrap complete!${RESET}\n"
echo "  Next steps:"
echo "  1.  Fill in .env  (DATABASE_URL, GRAPH_*, GMAIL_*, N8N_*)"
echo "  2.  cd infra && docker compose up -d"
echo "  3.  source backend/.venv/bin/activate"
echo "  4.  cd frontend && npm run dev"
echo "  5.  Open http://localhost:5173  and  http://localhost:8000/docs"
echo ""
