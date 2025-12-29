#!/bin/bash
set -euo pipefail

# Defaults
export YES_MODE="${YES_MODE:-false}"
export DEFAULTS_MODE="${DEFAULTS_MODE:-false}"

parse_flags() {
  for arg in "$@"; do
    case "$arg" in
      --yes|-y)
        export YES_MODE=true
        ;;
      --defaults|-d)
        export DEFAULTS_MODE=true
        ;;
    esac
  done
}
