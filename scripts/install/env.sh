#!/bin/bash
set -euo pipefail

source scripts/utils/colors.sh
source scripts/utils/prompt.sh
source scripts/utils/require.sh

require_file .cf_tunnel_id

if [ -f ".env" ]; then
  log_warn ".env already exists. Not overwriting."
  if ! confirm "Do you want to regenerate .env?"; then
    exit 0
  fi
fi

BASE_DOMAIN="$(prompt "Base domain (e.g. sensualbyte.com)" "sensualbyte.com")"
SSH_USER="$(prompt "Default SSH user (for computes)" "swapnil")"
MONGO_URI="$(prompt "Mongo URI" "mongodb://mongo:27017")"
MONGO_DB="$(prompt "Mongo DB name" "sensualbyte_platform")"

JWT_SECRET="$(prompt "JWT secret (leave blank to auto-generate)" "")"
if [ -z "$JWT_SECRET" ]; then
  require_cmd openssl
  JWT_SECRET="$(openssl rand -hex 32)"
fi

CF_TUNNEL_ID="$(cat .cf_tunnel_id)"

cat > .env <<EOF
# ============ Platform ============
NODE_ENV=production
PLATFORM_NAME=SENSUAL_SERVER

# ============ API ============
API_PORT=3001
JWT_SECRET=$JWT_SECRET
CORS_ORIGIN=http://localhost:3002

# ============ Mongo ============
MONGO_URI=$MONGO_URI
MONGO_DB=$MONGO_DB

# ============ Provisioner ============
SSH_USER=$SSH_USER
DEFAULT_CPU=1
DEFAULT_MEMORY_MB=512
DOCKER_NETWORK=sensual_net

# ============ Domains ============
BASE_DOMAIN=$BASE_DOMAIN

# ============ Cloudflare ============
CF_TUNNEL_ID=$CF_TUNNEL_ID
CF_TUNNEL_NAME=sensual-tunnel
EOF

log_ok ".env generated."
log_info "Now ensure infra/cloudflared/config.yml points to the correct credentials file for $CF_TUNNEL_ID"
