#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

source scripts/utils/colors.sh
source scripts/utils/require.sh

require_file .cf_tunnel_id
require_file .env
require_file infra/cloudflared/config.yml

# shellcheck disable=SC1091
source .env

TUNNEL_ID="$(cat .cf_tunnel_id)"
CONFIG_FILE="infra/cloudflared/config.yml"

CREDS_PATH="/home/nonroot/.cloudflared/${TUNNEL_ID}.json"

log_info "Updating Cloudflared config: ${CONFIG_FILE}"
log_info "credentials-file => ${CREDS_PATH}"

sed_in_place() {
  local expr="$1"
  local file="$2"
  if sed --version >/dev/null 2>&1; then
    sed -i "$expr" "$file"
  else
    sed -i '' "$expr" "$file"
  fi
}

# Replace tunnel name if present (optional)
if grep -Eq '^[[:space:]]*tunnel:' "$CONFIG_FILE"; then
  sed_in_place "s|^[[:space:]]*tunnel:.*|tunnel: ${CF_TUNNEL_NAME:-sensual-tunnel}|" "$CONFIG_FILE"
fi

# Replace credentials-file if present, else insert after tunnel
if grep -Eq '^[[:space:]]*credentials-file:' "$CONFIG_FILE"; then
  sed_in_place "s|^[[:space:]]*credentials-file:.*|credentials-file: ${CREDS_PATH}|" "$CONFIG_FILE"
  log_ok "Replaced existing credentials-file"
else
  if grep -Eq '^[[:space:]]*tunnel:' "$CONFIG_FILE"; then
    sed_in_place "/^[[:space:]]*tunnel:/a\\
credentials-file: ${CREDS_PATH}
" "$CONFIG_FILE"
    log_ok "Inserted credentials-file after tunnel"
  else
    die "cloudflared config missing 'tunnel:' key; add it first."
  fi
fi

log_ok "Cloudflare config updated."
