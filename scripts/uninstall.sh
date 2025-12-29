#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

source scripts/utils/flags.sh
parse_flags "$@"

source scripts/utils/colors.sh
source scripts/utils/prompt.sh

echo "=============================================="
echo "🧨 SENSUAL SERVER — UNINSTALL"
echo "=============================================="
echo ""
echo "This will REMOVE the SENSUAL SERVER platform from this machine."
echo ""

confirm "Continue uninstall?" || exit 0

bash scripts/uninstall/platform.sh

if confirm "Also delete Cloudflare tunnel and credentials?"; then
  bash scripts/uninstall/cloudflare.sh
else
  log_warn "Skipping Cloudflare tunnel removal"
fi

log_ok "Uninstall completed."
