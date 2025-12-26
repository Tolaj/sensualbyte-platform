#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "🔄 Rendering nginx routes..."
node scripts/render-nginx-routes.js

echo "🔄 Reloading nginx (compose service)..."
docker compose -f infra/docker-compose.yml exec -T nginx nginx -s reload

echo "✅ Nginx reloaded."
