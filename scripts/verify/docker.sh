#!/bin/bash
set -euo pipefail

source scripts/utils/colors.sh

echo "🐳 Docker containers:"
docker ps

# Validate core services exist
docker ps --format '{{.Names}}' | grep -q '^sensualbyte-api$' && log_ok "API container running" || log_warn "API container not found as 'sensualbyte-api'"
docker ps --format '{{.Names}}' | grep -q '^sensualbyte-nginx$' && log_ok "Nginx container running" || log_warn "Nginx container not found as 'sensualbyte-nginx'"
docker ps --format '{{.Names}}' | grep -q '^sensualbyte-mongo$' && log_ok "MongoDB container running" || log_warn "MongoDB container not found as 'sensualbyte-mongo'"
docker ps --format '{{.Names}}' | grep -q '^sensualbyte-dashboard$' && log_ok "Dashboard container running" || log_warn "Dashboard container not found as 'sensualbyte-dashboard'"
docker ps --format '{{.Names}}' | grep -q '^sensualbyte-cloudflared$' && log_ok "Cloudflared container running" || log_warn "Cloudflared container not found as 'sensualbyte-cloudflared'"

# Cloudflared may run in host network mode; name varies by compose project
if docker ps --format '{{.Names}}' | grep -q 'cloudflared'; then
  log_ok "cloudflared container running"
else
  log_warn "cloudflared container not detected (may still be OK if not configured yet)"
fi
