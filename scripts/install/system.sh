#!/bin/bash
set -euo pipefail

source scripts/utils/colors.sh
source scripts/utils/require.sh

log_info "Checking required commands..."

require_cmd git
require_cmd curl
require_cmd docker
require_cmd docker-compose || true
require_cmd jq || true
require_cmd node || true

log_ok "Core tools present."

log_info "Checking Docker daemon..."
docker info >/dev/null 2>&1 || die "Docker daemon not running. Start Docker and re-run."

log_ok "Docker is running."
