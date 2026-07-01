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
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
echo -e "${BOLD}\n  ╔════════════════════════════════════════╗"
echo    "  ║  IT Automation Platform — Bootstrap    ║"
echo    "  ║  Yvan Martineau                        ║"
echo -e "  ╚════════════════════════════════════════╝\n${RESET}"

# 1. Prerequisites
step "1/8  Prerequisites"
for cmd in git docker python3 node npm; do
  command -v "$cmd" &>/dev/null && ok "$cmd found" || warn "$cmd not found — install before proceeding"
done
# Ensure 'uv' is installed for high-performance Python isolation
if ! command -v uv &>/dev/null; then
  warn "uv not found — installing uv automatically..."
  curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null 2>&1
  export PATH="$HOME/.local/bin:$PATH"
fi
ok "uv dependency manager ready"

[[ "$(node -v 2>/dev/null | grep -oE '[0-9]+' | head -1)" -ge 20 ]] \
  && ok "Node.js ≥ 20" || warn "Node.js < 20 — upgrade recommended"

# 2. Git init
step "2/8  Git repository"
[[ -d ".git" ]] && ok "Already a git repo" || { git init && ok "git init done"; }
git checkout -b main 2>/dev/null || git checkout main 2>/dev/null || true

# 3. Hooks
step "3/8  Git hooks"
git config core.hooksPath .git-hooks
chmod +x .git-hooks/pre-commit .git-hooks/commit-msg
ok "Hooks linked from .git-hooks/ — core.hooksPath set"

# 4. .env
step "4/8  Environment file"
if [[ -f ".env" ]]; then
  warn ".env already exists — not overwriting"
else
  cp .env.example .env
  ok ".env created — fill in all REPLACE_ values before running docker compose"
fi

# 5. JWT secret auto-fill
step "5/8  JWT secret"
if grep -q "REPLACE_WITH_64_HEX_CHARS" .env 2>/dev/null; then
  KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  [[ "$OSTYPE" == darwin* ]] && sed -i '' "s/REPLACE_WITH_64_HEX_CHARS/$KEY/" .env \
                               || sed -i  "s/REPLACE_WITH_64_HEX_CHARS/$KEY/" .env
  ok "JWT_SECRET_KEY auto-generated and written to .env"
else
  ok "JWT_SECRET_KEY already set"
fi

# 6. Python venv (Targeting Python 3.12 explicitly)
step "6/8  Python virtual environment (backend via uv)"
if [[ ! -d "backend/.venv" ]]; then
  # uv automatically downloads and symlinks isolated Python 3.12 binaries completely independent of system paths
  uv venv backend/.venv --python 3.12 --quiet
fi

# Syncing pinned dependencies seamlessly into the environment
uv pip compile backend/requirements.txt -o backend/requirements.txt --quiet 2>/dev/null || true
uv pip sync backend/requirements.txt --python backend/.venv/bin/python --quiet
ok "Backend deps installed flawlessly using isolated Python 3.12 (venv at backend/.venv)"

# 7. Frontend deps
step "7/8  Frontend (npm install)"
if [[ -d "frontend/node_modules" ]]; then
  ok "node_modules already present"
else
  (cd frontend && npm install --silent) && ok "Frontend deps installed"
fi

# 8. Initial commit
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
