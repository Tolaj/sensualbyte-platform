#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

source scripts/utils/colors.sh
source scripts/utils/prompt.sh
source scripts/utils/require.sh

# If cloudflared missing, don't fail uninstall.
if ! command -v cloudflared >/dev/null 2>&1; then
  log_warn "cloudflared not installed; skipping Cloudflare tunnel cleanup."
  exit 0
fi

if [ ! -f ".cf_tunnel_id" ]; then
  log_warn "No .cf_tunnel_id found. Skipping Cloudflare cleanup."
  exit 0
fi

TUNNEL_ID="$(cat .cf_tunnel_id)"
CREDS_DIR="/home/${USER}/.cloudflared"
CREDS_FILE="${CREDS_DIR}/${TUNNEL_ID}.json"
CONFIG_FILE="infra/cloudflared/config.yml"

log_warn "About to delete Cloudflare tunnel:"
echo "  Tunnel ID: $TUNNEL_ID"
echo ""

confirm "This permanently deletes the tunnel in Cloudflare. Continue?" || exit 0

log_info "Deleting Cloudflare tunnel..."
cloudflared tunnel delete "$TUNNEL_ID" || log_warn "Tunnel may already be deleted (continuing)."

if [ -f "$CREDS_FILE" ]; then
  rm -f "$CREDS_FILE"
  log_ok "Deleted local tunnel credentials: $CREDS_FILE"
else
  log_warn "No local creds file found at: $CREDS_FILE"
fi

# if confirm "Delete infra/cloudflared/config.yml too?"; then
#   rm -f "$CONFIG_FILE" || true
#   log_ok "Deleted $CONFIG_FILE"
# else
#   log_info "Keeping $CONFIG_FILE"
# fi

rm -f .cf_tunnel_id || true
log_ok "Cloudflare tunnel cleanup complete."
