#!/usr/bin/env bash
# ============================================================
#  chaos-injection.sh — Controlled Failure & Resiliency Verification
#  Simulates database drops, container pauses, and network partitioning.
# ============================================================
set -euo pipefail

ACTION="${1:-help}"
TARGET_CONTAINER="postgres_local"

echo "⚡ [CHAOS ENGINE] Initiating scenario: $ACTION"

case "$ACTION" in
  db-kill)
    echo "⚡ Simulating sudden database crash (SIGKILL on $TARGET_CONTAINER)..."
    docker kill -s SIGKILL "$TARGET_CONTAINER"
    echo "✓ Database abruptly terminated. Observe FastAPI reconnect behavior or 503 handling."
    echo "  Recovery command: docker compose -f infra/docker-compose.yml up -d postgres_local"
    ;;
  
  db-pause)
    echo "⚡ Pausing database container (Simulating network/IO freeze)..."
    docker pause "$TARGET_CONTAINER"
    sleep 10
    echo "⚡ Resuming database container..."
    docker unpause "$TARGET_CONTAINER"
    echo "✓ Database unpaused. Verify transaction recovery or connection pooling resilience."
    ;;

  network-partition)
    echo "⚡ Simulating network isolation for n8n container..."
    docker network disconnect bridge n8n 2>/dev/null || true
    echo "✓ n8n isolated from internal network. FastAPI onboarding background task should fail gracefully without crashing core user creation."
    sleep 10
    echo "⚡ Restoring n8n network connectivity..."
    docker network connect bridge n8n 2>/dev/null || true
    echo "✓ Network restored."
    ;;

  *)
    echo "Usage: bash scripts/chaos-injection.sh [db-kill|db-pause|network-partition]"
    exit 1
    ;;
esac