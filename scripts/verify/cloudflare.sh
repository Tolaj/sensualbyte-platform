# scripts/verify/cloudflare.sh
#!/bin/bash
set -euo pipefail

source scripts/utils/colors.sh
source scripts/utils/prompt.sh
source scripts/utils/require.sh

require_cmd curl

if [ ! -f ".env" ]; then
  log_warn ".env not found; skipping Cloudflare verify."
  exit 0
fi

# shellcheck disable=SC1091
source .env

if [ -z "${BASE_DOMAIN:-}" ]; then
  log_warn "BASE_DOMAIN missing in .env; skipping Cloudflare verify."
  exit 0
fi

PUBLIC_HOST="$(prompt "Public hostname to check" "ecs.${BASE_DOMAIN}")"

if curl -fsSI "https://${PUBLIC_HOST}" >/dev/null 2>&1; then
  log_ok "Cloudflare public route OK: https://${PUBLIC_HOST}"
else
  log_warn "Cloudflare public route not reachable yet: https://${PUBLIC_HOST}"
  log_info "This can be normal if DNS/Tunnel isn't fully set up, or cloudflared container is restarting."
fi
