#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

source scripts/utils/colors.sh
source scripts/utils/require.sh

require_file .cf_tunnel_id
require_file .env

# Load env
# shellcheck disable=SC1091
source .env

TUNNEL_ID="$(cat .cf_tunnel_id)"
CONFIG_DIR="infra/cloudflared"
CONFIG_FILE="$CONFIG_DIR/config.yml"
CREDS_PATH="/home/${USER}/.cloudflared/${TUNNEL_ID}.json"

log_info "Rendering Cloudflare config.yml"

mkdir -p "$CONFIG_DIR"

cat > "$CONFIG_FILE" <<EOF
tunnel: ${CF_TUNNEL_NAME:-sensual-tunnel}
credentials-file: ${CREDS_PATH}

ingress:
  - hostname: nginx.${BASE_DOMAIN}
    service: http://localhost:8080

  - hostname: ecs.${BASE_DOMAIN}
    service: http://localhost:8080

  - hostname: "*.ecs.${BASE_DOMAIN}"
    service: http://localhost:8080

  # Uncomment if you want SSH over Cloudflare later
  # - hostname: ssh.${BASE_DOMAIN}
  #   service: tcp://localhost:22

  - service: http_status:404
EOF

log_ok "Cloudflare config written:"
log_info "  $CONFIG_FILE"
log_info "  credentials-file: $CREDS_PATH"
