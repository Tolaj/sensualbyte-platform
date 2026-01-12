# scripts/verify/docker.sh
#!/bin/bash
set -euo pipefail

source scripts/utils/colors.sh
source scripts/utils/require.sh

require_cmd docker

echo "🐳 Docker containers (running):"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
echo ""

need_running() {
  local name="$1"
  if docker ps --format '{{.Names}}' | grep -qx "$name"; then
    log_ok "Running: $name"
  else
    log_error "Missing (not running): $name"
    return 1
  fi
}

# core services in your compose
need_running "sb-mongo"
need_running "sb-redis"
need_running "sb-minio"
need_running "sb-nginx"
need_running "sb-api"
need_running "sb-worker"
need_running "sb-dashboard"

# cloudflared is optional (but if enabled, should be running)
if docker ps --format '{{.Names}}' | grep -q 'cloudflared'; then
  log_ok "Cloudflared container detected"
else
  log_warn "Cloudflared container not detected (OK if you didn't enable tunnel yet)"
fi

log_ok "Docker check done"
