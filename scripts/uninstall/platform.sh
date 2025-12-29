#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

source scripts/utils/colors.sh
source scripts/utils/prompt.sh
source scripts/utils/require.sh

require_file infra/docker-compose.yml

log_info "Stopping platform containers..."

docker compose -f infra/docker-compose.yml down || true

log_ok "Docker services stopped."

if confirm "Delete runtime state files (services, computes, projects)?"; then
  rm -f runtime/services.json runtime/computes.json runtime/projects.json || true
  log_ok "runtime state deleted."
else
  log_info "runtime state preserved."
fi

if confirm "Delete generated nginx routing files?"; then
  rm -f infra/nginx/sensual-apps.conf infra/nginx/sensual-apps-servers.conf || true
  log_ok "nginx generated configs deleted."
fi

log_ok "Platform files cleaned."
