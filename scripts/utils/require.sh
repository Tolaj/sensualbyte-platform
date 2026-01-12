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
  [ -n "${!k:-}" ] || { echo "❌ Missing env var: $k"; exit 1; }
}

docker_compose() {
  # Prefer docker compose (v2)
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return 0
  fi
  # Fallback
  if command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
    return 0
  fi
  return 1
}

require_docker_compose() {
  docker_compose >/dev/null 2>&1 || { echo "❌ Missing docker compose (docker compose or docker-compose)"; exit 1; }
}
