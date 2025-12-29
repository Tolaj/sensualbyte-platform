#!/bin/bash
set -e

echo "📦 Installing required packages (Ubuntu)..."
sudo apt update
sudo apt install -y docker.io docker-compose nodejs npm jq

sudo usermod -aG docker $USER
echo "⚠️ Logout & login again if Docker permission fails"
