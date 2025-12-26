#!/bin/bash
set -euo pipefail

echo "🔄 Rendering nginx routes..."
node scripts/render-nginx-apps.js

echo "🔄 Reloading nginx container..."
docker exec -i nginx nginx -s reload

echo "✅ Nginx reloaded."
