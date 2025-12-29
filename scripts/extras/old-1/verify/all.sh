#!/bin/bash
set -e
echo "🧪 Running full sanity check..."

./scripts/verify/01-health-check.sh
./scripts/verify/03-docker-check.sh
./scripts/verify/04-nginx-check.sh

echo "✅ ALL CHECKS PASSED"
