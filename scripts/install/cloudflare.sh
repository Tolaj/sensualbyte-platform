#!/bin/bash
set -euo pipefail

source scripts/utils/colors.sh
source scripts/utils/prompt.sh
source scripts/utils/require.sh

require_cmd cloudflared

log_info "Cloudflare setup..."

# Try a harmless command to detect login
if ! cloudflared tunnel list >/dev/null 2>&1; then
  log_warn "Cloudflare not authenticated on this machine."
  log_info "Opening Cloudflare login..."
  cloudflared tunnel login
fi

TUNNEL_NAME="$(prompt "Tunnel name" "sensual-tunnel")"

# Create if doesn't exist
if cloudflared tunnel list | awk '{print $2}' | grep -qx "$TUNNEL_NAME"; then
  log_warn "Tunnel already exists: $TUNNEL_NAME"
else
  log_info "Creating tunnel: $TUNNEL_NAME"
  cloudflared tunnel create "$TUNNEL_NAME"
fi

# Get tunnel id
TUNNEL_ID="$(cloudflared tunnel list | awk -v n="$TUNNEL_NAME" '$2==n {print $1}' | head -n 1)"
[ -n "$TUNNEL_ID" ] || die "Could not determine tunnel id for: $TUNNEL_NAME"

echo "$TUNNEL_ID" > .cf_tunnel_id
log_ok "Tunnel ready: $TUNNEL_ID"
