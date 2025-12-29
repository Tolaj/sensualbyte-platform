#!/bin/bash
set -e

echo "⚙️ Creating .env interactively"

read -p "Base domain (e.g. sensualbyte.com): " BASE_DOMAIN
read -p "Mongo URI (default: mongodb://localhost:27017): " MONGO_URI
MONGO_URI=${MONGO_URI:-mongodb://localhost:27017}

read -p "SSH default user: " SSH_USER
read -p "JWT secret (leave blank to auto-generate): " JWT_SECRET

if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
fi

CF_TUNNEL_ID=$(cat .cf_tunnel_id)

cat > .env <<EOF
NODE_ENV=production
API_PORT=3001

JWT_SECRET=$JWT_SECRET

MONGO_URI=$MONGO_URI
MONGO_DB=sensual_platform

SSH_USER=$SSH_USER
DEFAULT_CPU=1
DEFAULT_MEMORY_MB=512
DOCKER_NETWORK=sensual_net

BASE_DOMAIN=$BASE_DOMAIN
CF_TUNNEL_ID=$CF_TUNNEL_ID
EOF

echo "✅ .env created"
