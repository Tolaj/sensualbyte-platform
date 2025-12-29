#!/bin/bash
set -euo pipefail

# expects flags.sh to be sourced before this
prompt() {
  local msg="$1"
  local def="${2:-}"

  if is_defaults; then
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

  if is_yes; then
    echo "✔ $msg (auto-yes)"
    return 0
  fi

  local yn=""
  read -r -p "$msg (y/n): " yn
  [[ "$yn" == "y" || "$yn" == "Y" ]]
}
