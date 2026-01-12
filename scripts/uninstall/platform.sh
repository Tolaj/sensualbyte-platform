#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

source scripts/utils/colors.sh
source scripts/utils/prompt.sh
source scripts/utils/require.sh

COMPOSE_FILE="infra/compose/docker-compose.prod.yml"
require_file "$COMPOSE_FILE"

log_info "Stopping platform containers..."
docker compose --env-file .env -f "$COMPOSE_FILE" down --remove-orphans || true
log_ok "Containers stopped."

if confirm "Delete named volumes (mongo/redis/minio/nginx routes)?"; then
  log_warn "Removing volumes..."
  docker compose --env-file .env -f "$COMPOSE_FILE" down -v --remove-orphans || true
  log_ok "Volumes removed."
else
  log_info "Volumes preserved."
fi

# If your compose project name is "sensualbyte", docker will name it like:
# sensualbyte_sb_nginx_routes
VOLUME_NAME="sensualbyte_sb_nginx_routes"

if confirm "Clear generated nginx route volume contents ($VOLUME_NAME)?"; then
  docker run --rm -v "${VOLUME_NAME}:/data" alpine sh -lc 'rm -rf /data/*' || true
  log_ok "Generated routes cleared."
else
  log_info "Generated routes preserved."
fi

if confirm "Delete local runtime folder (runtime/) if it exists?"; then
  rm -rf runtime || true
  log_ok "runtime/ deleted."
else
  log_info "runtime/ preserved."
fi

log_ok "Platform uninstall cleanup done."
