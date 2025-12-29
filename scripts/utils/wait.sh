#!/bin/bash
set -euo pipefail

wait_for_url() {
  local url="$1"
  local timeout="${2:-60}"
  local start
  start="$(date +%s)"

  echo "⏳ Waiting for: $url (timeout ${timeout}s)"
  while true; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "✅ Ready: $url"
      return 0
    fi

    local now
    now="$(date +%s)"
    if [ $((now - start)) -ge "$timeout" ]; then
      echo "❌ Timeout waiting for: $url"
      return 1
    fi

    sleep 2
  done
}
