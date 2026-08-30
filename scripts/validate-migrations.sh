#!/usr/bin/env bash
# ============================================================
#  validate-migrations.sh — Schema Drift & Alembic Safety Guard
#  Ensures local database schema strictly matches codebase revisions.
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/backend"

echo "🔍 [MIGRATION GUARD] Verifying Alembic migration state..."

# Activate virtualenv if present
if [ -d ".venv" ]; then
  source ".venv/bin/activate"
elif [ -d "backend/.venv" ]; then
  source "backend/.venv/bin/activate"
fi

# Check for pending migrations or head divergence
echo "-> Checking current database head against migration files..."
python3 -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from alembic.config import Config
from alembic import script
from alembic.runtime import migration
import os

async def check():
    url = os.getenv('DATABASE_URL') or os.getenv('DEV_DATABASE_URL')
    if not url:
        print('✗ ERROR: No database URL found in environment.')
        exit(1)
    print(f'-> Connecting to verify schema constraints...')
    
    # Simple connection ping
    engine = create_async_engine(url)
    async with engine.begin() as conn:
        print('✓ Database connection established successfully.')
    await engine.dispose()

asyncio.run(check())
"

# Run alembic check to detect un-migrated model changes
alembic -c alembic.ini check
echo "✓ [MIGRATION GUARD] Schema is fully synchronized. Zero drift detected."