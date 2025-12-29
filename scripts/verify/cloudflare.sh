#!/bin/bash
set -euo pipefail

source scripts/utils/colors.sh
source scripts/utils/prompt.sh

if [ ! -f ".env" ]; then
  log_warn ".env not found; skipping Cloudflare verify."
  exit 0
fi

# shellcheck disable=SC1091
source .env

if [ -z "${BASE_DOMAIN:-}" ]; then
  log_warn "BASE_DOMAIN missing; skipping Cloudflare verify."
  exit 0
fi

PUBLIC_HOST="$(prompt "Public hostname to check" "ecs.${BASE_DOMAIN}")"

if curl -fsSI "https://${PUBLIC_HOST}" >/dev/null 2>&1; then
  log_ok "Cloudflare public route OK: https://${PUBLIC_HOST}"
else
  log_warn "Cloudflare public route not reachable (DNS/tunnel may not be configured yet): https://${PUBLIC_HOST}"
fi
