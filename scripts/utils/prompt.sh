#!/bin/bash
set -euo pipefail

prompt() {
  local msg="$1"
  local def="${2:-}"

  if [ "${DEFAULTS_MODE:-false}" = "true" ]; then
    echo "$def"
    return
  fi

  local out=""
  if [ -n "$def" ]; then
    read -r -p "$msg [$def]: " out
    echo "${out:-$def}"
  else
    read -r -p "$msg: " out
    echo "$out"
  fi
}

confirm() {
  local msg="$1"

  if [ "${YES_MODE:-false}" = "true" ]; then
    echo "✔ $msg (auto-yes)"
    return 0
  fi

  local yn=""
  read -r -p "$msg (y/n): " yn
  [[ "$yn" == "y" || "$yn" == "Y" ]]
}
