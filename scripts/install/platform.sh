#!/bin/bash
set -euo pipefail

source scripts/utils/colors.sh
source scripts/utils/require.sh
source scripts/utils/wait.sh

require_file .env
require_file infra/docker-compose.yml

log_info "Preparing directories..."
mkdir -p runtime ssh-keys infra/nginx

# Initialize runtime state if missing (do not wipe if already present)
[ -f runtime/services.json ] || echo '{ "services": [] }' > runtime/services.json
[ -f runtime/computes.json ] || echo '{ "computes": [] }' > runtime/computes.json
[ -f runtime/projects.json ] || echo '{ "projects": [] }' > runtime/projects.json

log_info "Deploying platform via docker compose..."
docker compose -f infra/docker-compose.yml pull || true
docker compose -f infra/docker-compose.yml build
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps

wait_for_url "http://localhost:8080/api/health" 90 || die "API did not become healthy."

log_ok "Platform deployed and API is healthy."
