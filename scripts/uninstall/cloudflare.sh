#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

source scripts/utils/colors.sh
source scripts/utils/prompt.sh
source scripts/utils/require.sh

require_cmd cloudflared

if [ ! -f ".cf_tunnel_id" ]; then
  log_warn "No .cf_tunnel_id found. Skipping Cloudflare cleanup."
  exit 0
fi

TUNNEL_ID="$(cat .cf_tunnel_id)"
CREDS_FILE="/home/${USER}/.cloudflared/${TUNNEL_ID}.json"
CONFIG_FILE="infra/cloudflared/config.yml"

log_warn "About to DELETE Cloudflare tunnel:"
echo "  Tunnel ID: $TUNNEL_ID"
echo ""

confirm "This will permanently delete the tunnel. Continue?" || exit 0

log_info "Deleting Cloudflare tunnel..."
cloudflared tunnel delete "$TUNNEL_ID" || log_warn "Tunnel may already be deleted."

if [ -f "$CREDS_FILE" ]; then
  rm -f "$CREDS_FILE"
  log_ok "Deleted local tunnel credentials."
fi

if [ -f "$CONFIG_FILE" ]; then
  rm -f "$CONFIG_FILE"
  log_ok "Deleted generated cloudflared config.yml"
fi

rm -f .cf_tunnel_id || true

log_ok "Cloudflare tunnel cleanup complete."
