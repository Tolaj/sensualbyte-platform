#!/bin/bash
set -e

echo "🌐 Cloudflare Tunnel Setup"

read -p "Do you have a Cloudflare account logged in on this machine? (y/n): " haslogin
if [ "$haslogin" != "y" ]; then
  cloudflared tunnel login
fi

read -p "Enter tunnel name (default: sensual-tunnel): " TUNNEL_NAME
TUNNEL_NAME=${TUNNEL_NAME:-sensual-tunnel}

cloudflared tunnel create "$TUNNEL_NAME"

TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')

echo "✅ Tunnel created: $TUNNEL_ID"
echo "$TUNNEL_ID" > .cf_tunnel_id
