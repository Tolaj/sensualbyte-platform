#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

source scripts/utils/flags.sh
parse_flags "$@"

source scripts/utils/colors.sh

# -------------------------
# Pick verify MODE (docker|nginx|api|cloudflare|full)
# from first NON-flag arg
# -------------------------
VERIFY_MODE="full"
for a in "$@"; do
  case "$a" in
    --yes|-y|--defaults|-d|--prod|--dev) ;;   # ignore flags
    docker|nginx|api|cloudflare|full) VERIFY_MODE="$a"; break ;;
    *) ;; # ignore unknown extra args
  esac
done

# -------------------------
# Choose compose file based on MODE (dev/prod)
# MODE is set by flags.sh (default prod)
# -------------------------
COMPOSE_FILE="${COMPOSE_FILE:-}"
if [ -z "$COMPOSE_FILE" ]; then
  if [ "${MODE:-prod}" = "dev" ]; then
    if [ -f "infra/compose/docker-compose.dev.yml" ]; then
      COMPOSE_FILE="infra/compose/docker-compose.dev.yml"
    elif [ -f "infra/docker-compose.dev.yml" ]; then
      COMPOSE_FILE="infra/docker-compose.dev.yml"
    else
      COMPOSE_FILE="infra/compose/docker-compose.prod.yml"
    fi
  else
    if [ -f "infra/compose/docker-compose.prod.yml" ]; then
      COMPOSE_FILE="infra/compose/docker-compose.prod.yml"
    else
      COMPOSE_FILE="infra/compose/docker-compose.dev.yml"
    fi
  fi
fi
export COMPOSE_FILE

log_info "Platform mode: ${MODE:-prod}"
log_info "Verify mode: $VERIFY_MODE"
log_info "Compose file: $COMPOSE_FILE"
echo ""

case "$VERIFY_MODE" in
  docker)      bash scripts/verify/docker.sh ;;
  nginx)       bash scripts/verify/nginx.sh ;;
  api)         bash scripts/verify/api-smoke.sh ;;
  cloudflare)  bash scripts/verify/cloudflare.sh ;;
  full)
    bash scripts/verify/docker.sh
    bash scripts/verify/nginx.sh
    bash scripts/verify/api-smoke.sh
    bash scripts/verify/cloudflare.sh
    ;;
  *)
    log_error "Unknown verify mode: $VERIFY_MODE"
    echo "Usage:"
    echo "  ./scripts/verify.sh [--dev|--prod] [--yes] [--defaults] docker|nginx|api|cloudflare|full"
    exit 1
    ;;
esac

log_ok "Verify completed: $VERIFY_MODE"
