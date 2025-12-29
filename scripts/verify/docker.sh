#!/bin/bash
set -euo pipefail

source scripts/utils/colors.sh

echo "🐳 Docker containers:"
docker ps

# Validate core services exist
docker ps --format '{{.Names}}' | grep -q '^api$' && log_ok "API container running" || log_warn "API container not found as 'api'"
docker ps --format '{{.Names}}' | grep -q '^nginx$' && log_ok "Nginx container running" || log_warn "Nginx container not found as 'nginx'"

# Cloudflared may run in host network mode; name varies by compose project
if docker ps --format '{{.Names}}' | grep -q 'cloudflared'; then
  log_ok "cloudflared container running"
else
  log_warn "cloudflared container not detected (may still be OK if not configured yet)"
fi
