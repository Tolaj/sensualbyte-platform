# scripts/verify/nginx.sh
#!/bin/bash
set -euo pipefail

source scripts/utils/colors.sh
source scripts/utils/require.sh

require_cmd curl

NGINX_URL="${NGINX_URL:-http://localhost:8080}"

# 1) nginx base reachable
if curl -fsS "$NGINX_URL/" >/dev/null 2>&1; then
  log_ok "Nginx reachable: $NGINX_URL/"
else
  log_error "Nginx NOT reachable: $NGINX_URL/"
  exit 1
fi

# 2) api through nginx
if curl -fsS "$NGINX_URL/api/healthz" >/dev/null 2>&1; then
  log_ok "API reachable via nginx: $NGINX_URL/api/healthz"
else
  log_error "API NOT reachable via nginx: $NGINX_URL/api/healthz"
  log_info "Hint: ensure your nginx base conf has:"
  log_info "  location /api/ { proxy_pass http://sb-api:3001/; }"
  exit 1
fi

log_ok "Nginx check done"
