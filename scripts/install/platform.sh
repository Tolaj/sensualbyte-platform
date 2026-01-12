#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

source scripts/utils/colors.sh
source scripts/utils/require.sh
source scripts/utils/wait.sh
source scripts/utils/flags.sh

require_file .env

COMPOSE_FILE="infra/compose/docker-compose.prod.yml"
if [ "${MODE:-prod}" = "dev" ]; then
  COMPOSE_FILE="infra/compose/docker-compose.dev.yml"
fi
require_file "$COMPOSE_FILE"

DC="$(docker_compose)"

log_info "Deploying platform (${MODE}) using: ${COMPOSE_FILE}"
$DC --env-file .env -f "$COMPOSE_FILE" pull || true
$DC --env-file .env -f "$COMPOSE_FILE" build
$DC --env-file .env -f "$COMPOSE_FILE" up -d
$DC --env-file .env -f "$COMPOSE_FILE" ps

# Health check (via nginx)
wait_for_url "http://localhost:8080/api/healthz" 120 || die "API did not become healthy via nginx."

log_ok "Platform deployed and API is healthy."
