#!/bin/bash
set -euo pipefail

source scripts/utils/colors.sh
source scripts/utils/prompt.sh
source scripts/utils/require.sh

# cloudflared CLI is needed for create/list/route DNS
require_cmd cloudflared

log_info "Cloudflare setup..."

# detect login
if ! cloudflared tunnel list >/dev/null 2>&1; then
  log_warn "Cloudflare not authenticated on this machine."
  log_info "Opening Cloudflare login..."
  cloudflared tunnel login
fi

TUNNEL_NAME="$(prompt "Tunnel name" "sensualbyte-tunnel")"

if cloudflared tunnel list 2>/dev/null | awk 'NR>1 {print $2}' | grep -qx "$TUNNEL_NAME"; then
  log_warn "Tunnel already exists: $TUNNEL_NAME"
else
  log_info "Creating tunnel: $TUNNEL_NAME"
  cloudflared tunnel create "$TUNNEL_NAME"
fi

TUNNEL_ID="$(cloudflared tunnel list 2>/dev/null | awk -v n="$TUNNEL_NAME" 'NR>1 && $2==n {print $1}' | head -n 1)"
[ -n "$TUNNEL_ID" ] || die "Could not determine tunnel id for: $TUNNEL_NAME"

echo "$TUNNEL_ID" > .cf_tunnel_id
echo "$TUNNEL_NAME" > .cf_tunnel_name

log_ok "Tunnel ready: $TUNNEL_ID ($TUNNEL_NAME)"

# DNS routes (idempotent-ish)
ensure_dns_route() {
  local host="$1"
  if cloudflared tunnel route dns list 2>/dev/null | grep -qw "$host"; then
    log_warn "DNS route already exists for $host, skipping..."
  else
    log_info "Routing DNS: $host -> $TUNNEL_NAME"
    cloudflared tunnel route dns --overwrite-dns "$TUNNEL_NAME" "$host"
    log_ok "DNS routing complete for $host"
  fi
}

ensure_dns_route "ecs.sensualbyte.com"
ensure_dns_route "ssh.sensualbyte.com"
ensure_dns_route "*.ecs.sensualbyte.com"

log_ok "Cloudflare DNS routing ensured."
