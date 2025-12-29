#!/bin/bash
set -e

echo "🔍 Checking system requirements..."

for cmd in curl git docker docker-compose node npm; do
  if ! command -v $cmd >/dev/null; then
    echo "❌ Missing: $cmd"
    exit 1
  fi
done

echo "✅ System OK"
