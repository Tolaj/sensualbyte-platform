#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

source scripts/utils/colors.sh
source scripts/utils/require.sh

require_file .cf_tunnel_id
require_file .env

# shellcheck disable=SC1091
source .env

TUNNEL_ID="$(cat .cf_tunnel_id)"

CONFIG_DIR="infra/cloudflared"
CONFIG_FILE="${CONFIG_DIR}/config.yml"

# Path MUST be inside the cloudflared container (matches your compose volume)
CREDS_PATH="/home/nonroot/.cloudflared/${TUNNEL_ID}.json"

require_file "$CONFIG_FILE"

log_info "Updating only credentials-file in ${CONFIG_FILE}"
log_info "New credentials-file: ${CREDS_PATH}"

# Use portable sed in-place (works on GNU sed and BSD sed)
sed_in_place() {
  local expr="$1"
  local file="$2"
  if sed --version >/dev/null 2>&1; then
    # GNU sed (Linux)
    sed -i "$expr" "$file"
  else
    # BSD sed (macOS)
    sed -i '' "$expr" "$file"
  fi
}

# 1) If credentials-file exists, replace it (even if indented)
if grep -Eq '^[[:space:]]*credentials-file:' "$CONFIG_FILE"; then
  sed_in_place "s|^[[:space:]]*credentials-file:.*|credentials-file: ${CREDS_PATH}|" "$CONFIG_FILE"
  log_ok "Replaced existing credentials-file"
else
  # 2) If tunnel exists, insert right after it (preserves YAML structure)
  if grep -Eq '^[[:space:]]*tunnel:' "$CONFIG_FILE"; then
    sed_in_place "/^[[:space:]]*tunnel:/a\\
credentials-file: ${CREDS_PATH}
" "$CONFIG_FILE"
    log_ok "Inserted credentials-file after tunnel"
  else
    # 3) If neither exists, prepend at top (safe fallback)
    tmp="$(mktemp)"
    {
      echo "credentials-file: ${CREDS_PATH}"
      cat "$CONFIG_FILE"
    } > "$tmp"
    mv "$tmp" "$CONFIG_FILE"
    log_ok "Prepended credentials-file at top (no tunnel key found)"
  fi
fi

log_ok "Cloudflare config updated successfully"
