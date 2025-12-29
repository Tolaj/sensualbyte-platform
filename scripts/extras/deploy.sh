#!/bin/bash
set -euo pipefail

echo "🚀 Deploying SENSUAL SERVER (prod compose)..."

cd "$(dirname "$0")/.."

# Pull external images (nginx/cloudflared). Build local images (api).
docker compose -f infra/docker-compose.yml pull || true
docker compose -f infra/docker-compose.yml build

docker compose -f infra/docker-compose.yml up -d

docker compose -f infra/docker-compose.yml ps
echo "✅ Done."
