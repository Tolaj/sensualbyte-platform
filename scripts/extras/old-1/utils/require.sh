#!/bin/bash
set -e

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ Required command missing: $1"
    exit 1
  fi
}

require_env() {
  if [ -z "${!1}" ]; then
    echo "❌ Required env var missing: $1"
    exit 1
  fi
}
