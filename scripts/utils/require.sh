#!/bin/bash
set -euo pipefail

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing required command: $1"; exit 1; }
}

require_file() {
  [ -f "$1" ] || { echo "❌ Missing required file: $1"; exit 1; }
}

require_dir() {
  [ -d "$1" ] || { echo "❌ Missing required directory: $1"; exit 1; }
}

require_env_var() {
  local k="$1"
  # shellcheck disable=SC2154
  [ -n "${!k:-}" ] || { echo "❌ Missing env var: $k"; exit 1; }
}
