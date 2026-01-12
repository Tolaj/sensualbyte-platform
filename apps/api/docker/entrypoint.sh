#!/bin/sh
set -eu

echo "[api] starting…"

# Run DB setup + seed (idempotent). If you want seed only once, see note below.
echo "[api] db:setup"
node src/db/setup.js

echo "[api] db:seed"
node src/db/seed.js

echo "[api] launching server"
exec node src/server.js
