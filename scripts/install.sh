#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

source scripts/utils/flags.sh
parse_flags "$@"

source scripts/utils/colors.sh
source scripts/utils/prompt.sh

echo "=============================================="
echo "🚀 SENSUAL SERVER — INSTALLER"
echo "=============================================="
echo ""

if ! confirm "Continue installation?"; then
  exit 0
fi

bash scripts/install/system.sh
bash scripts/install/cloudflare.sh
bash scripts/install/env.sh
bash scripts/install/cloudflare-config.sh
bash scripts/install/platform.sh

log_ok "Installation complete."

if confirm "Run full sanity check now?"; then
  bash scripts/verify.sh
fi
