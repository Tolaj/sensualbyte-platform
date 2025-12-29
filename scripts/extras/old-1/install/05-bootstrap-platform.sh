#!/bin/bash
set -e

echo "🚀 Bootstrapping platform..."

mkdir -p runtime ssh-keys infra/nginx

echo '{ "services": [] }' > runtime/services.json
echo '{ "computes": [] }' > runtime/computes.json
echo '{ "projects": [] }' > runtime/projects.json

docker compose -f infra/docker-compose.yml build
docker compose -f infra/docker-compose.yml up -d

echo "✅ Platform deployed"
