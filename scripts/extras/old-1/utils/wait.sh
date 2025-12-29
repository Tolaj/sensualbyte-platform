#!/bin/bash

wait_for_url() {
  local url="$1"
  local timeout="${2:-60}"

  echo "⏳ Waiting for $url (timeout ${timeout}s)..."

  for ((i=0;i<timeout;i+=2)); do
    if curl -fs "$url" >/dev/null 2>&1; then
      echo "✅ Ready: $url"
      return 0
    fi
    sleep 2
  done

  echo "❌ Timeout waiting for $url"
  exit 1
}
