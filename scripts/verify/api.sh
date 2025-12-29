#!/bin/bash
set -euo pipefail

source scripts/utils/colors.sh

curl -fsS http://localhost:8080/api/health >/dev/null 2>&1 && log_ok "API health endpoint OK" || {
  log_error "API health endpoint failed: http://localhost:8080/api/health"
  exit 1
}
