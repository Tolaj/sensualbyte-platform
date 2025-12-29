#!/bin/bash
set -euo pipefail

# Safe defaults if flags not loaded
is_yes() { return 1; }
is_defaults() { return 1; }

# Override if flags.sh was sourced
type is_yes >/dev/null 2>&1 || true
type is_defaults >/dev/null 2>&1 || true

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
