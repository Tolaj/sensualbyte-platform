#!/bin/bash
set -euo pipefail

YES_MODE=false
DEFAULTS_MODE=false

parse_flags() {
  for arg in "$@"; do
    case "$arg" in
      --yes|-y)
        YES_MODE=true
        ;;
      --defaults|-d)
        DEFAULTS_MODE=true
        ;;
      *)
        ;;
    esac
  done
}

is_yes() {
  [ "$YES_MODE" = true ]
}

is_defaults() {
  [ "$DEFAULTS_MODE" = true ]
}
