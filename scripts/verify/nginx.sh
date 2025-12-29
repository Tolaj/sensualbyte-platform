#!/bin/bash
set -euo pipefail

source scripts/utils/colors.sh

curl -fsS http://localhost:8080 >/dev/null 2>&1 && log_ok "Nginx reachable at http://localhost:8080" || {
  log_error "Nginx not reachable on http://localhost:8080"
  exit 1
}
