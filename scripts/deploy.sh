#!/usr/bin/env bash
set -euo pipefail
echo "Dev deploy (local): run compose then api+worker"
docker compose -f infra/docker-compose.dev.yml up -d
npm -w apps/api run db:setup
npm -w apps/api run db:seed
