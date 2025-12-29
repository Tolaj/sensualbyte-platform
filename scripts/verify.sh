#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

source scripts/utils/colors.sh

log_info "Running full verification suite..."

bash scripts/verify/docker.sh
bash scripts/verify/nginx.sh
bash scripts/verify/api.sh
bash scripts/verify/cloudflare.sh || true

log_ok "Sanity checks complete."
