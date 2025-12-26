#!/bin/bash
set -euo pipefail

echo "🧪 Dev mode (local API + local frontend recommended)"
echo "1) Start Mongo (if needed): docker run -d --name sensual-mongo -p 27017:27017 mongo:7"
echo "2) Start API: cd apps/api && npm i && npm run dev"
echo "3) Start Dashboard: cd apps/dashboard/frontend && npm i && npm run dev"
