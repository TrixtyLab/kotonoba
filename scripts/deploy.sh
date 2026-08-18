#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
IMAGE_TAG="${1:-latest}"
HEALTH_TIMEOUT=45
HEALTH_INTERVAL=3

echo "=== Starting Kotonoba Blue-Green Deployment ==="
echo "Target Image Tag: ${IMAGE_TAG}"

if grep -q "app-blue" nginx/conf.d/upstream.conf; then
    CURRENT_ACTIVE="app-blue"
    TARGET_CONTAINER="app-green"
else
    CURRENT_ACTIVE="app-green"
    TARGET_CONTAINER="app-blue"
fi

echo "Current Active Slot: ${CURRENT_ACTIVE}"
echo "Deploying to Target Slot: ${TARGET_CONTAINER}"

docker compose -f "${COMPOSE_FILE}" pull "${TARGET_CONTAINER}" || true
docker compose -f "${COMPOSE_FILE}" up -d --no-deps "${TARGET_CONTAINER}"

echo "Waiting for ${TARGET_CONTAINER} to pass health checks..."
ELAPSED=0
HEALTHY=false

while [ "${ELAPSED}" -lt "${HEALTH_TIMEOUT}" ]; do
    STATUS=$(docker inspect --format='{{json .State.Health.Status}}' "blog-${TARGET_CONTAINER}" 2>/dev/null || echo "\"unknown\"")
    
    if [ "${STATUS}" = "\"healthy\"" ]; then
        HEALTHY=true
        break
    fi

    echo "  Status: ${STATUS} (${ELAPSED}s / ${HEALTH_TIMEOUT}s)..."
    sleep "${HEALTH_INTERVAL}"
    ELAPSED=$((ELAPSED + HEALTH_INTERVAL))
done

if [ "${HEALTHY}" = true ]; then
    echo " Target container is HEALTHY! Switching traffic..."
    
    cat <<EOF > nginx/conf.d/upstream.conf
upstream blog_backend {
    server ${TARGET_CONTAINER}:3000 max_fails=3 fail_timeout=10s;
}
EOF

    docker exec blog-nginx nginx -s reload
    echo " Nginx reloaded! Traffic successfully routed to ${TARGET_CONTAINER} (< 100ms switch)."

    echo "Stopping previous slot ${CURRENT_ACTIVE}..."
    docker compose -f "${COMPOSE_FILE}" stop "${CURRENT_ACTIVE}"
    echo "=== Deployment Completed Successfully! ==="
    exit 0
else
    echo "❌ Health check FAILED for ${TARGET_CONTAINER}."
    echo " Rolling back: Terminating ${TARGET_CONTAINER} and keeping ${CURRENT_ACTIVE} live."
    
    docker compose -f "${COMPOSE_FILE}" stop "${TARGET_CONTAINER}"
    docker compose -f "${COMPOSE_FILE}" rm -f "${TARGET_CONTAINER}"
    
    echo "❌ Deployment aborted. Rollback complete. No user traffic was affected."
    exit 1
fi
