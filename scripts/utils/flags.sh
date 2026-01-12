#!/bin/bash
set -euo pipefail

export YES_MODE="${YES_MODE:-false}"
export DEFAULTS_MODE="${DEFAULTS_MODE:-false}"
export MODE="${MODE:-prod}"

parse_flags() {
  for arg in "$@"; do
    case "$arg" in
      --yes|-y) export YES_MODE=true ;;
      --defaults|-d) export DEFAULTS_MODE=true ;;
      --prod) export MODE=prod ;;
      --dev) export MODE=dev ;;
      *) ;;
    esac
  done
}
