#!/usr/bin/env bash
# ============================================================
#  health-sentinel.sh — Crash Loop Monitor & Log Extractor
#  Monitors FastAPI and PostgreSQL, captures diagnostics on failure,
#  and attempts self-healing container recovery.
# ============================================================
set -uo pipefail

LOG_DIR="./logs/incident"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

check_service() {
    local service_name="$1"
    local health_command="$2"
    
    if eval "$health_command"; then
        return 0
    else
        echo "[$(date)] ALERT: Service '$service_name' is unhealthy or unresponsive."
        
        # Extract diagnostic logs
        docker compose -f infra/docker-compose.yml logs --tail=150 "$service_name" > "$LOG_DIR/${service_name}_fail_${TIMESTAMP}.log"
        echo "[$(date)] Diagnostic logs captured to $LOG_DIR/${service_name}_fail_${TIMESTAMP}.log"
        
        # Attempt recovery
        echo "[$(date)] Attempting recovery: restarting container '$service_name'..."
        docker compose -f infra/docker-compose.yml restart "$service_name"
        
        return 1
    fi
}

# Check FastAPI health endpoint (using host network mode mapping)
check_service "fastapi" "python3 -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)\""

# Check PostgreSQL container readiness
check_service "postgres_local" "docker exec postgres_local pg_isready -h 127.0.0.1 -U dev -d automation_dev"