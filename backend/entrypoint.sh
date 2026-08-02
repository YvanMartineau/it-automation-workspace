#!/bin/sh
set -e

echo "Running database setup..."

# Optional: Run Alembic migrations
# alembic upgrade head

# Run seed script
echo "Seeding database..."
python seed.py

echo "Starting FastAPI server..."
exec "$@"