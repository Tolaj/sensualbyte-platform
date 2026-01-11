#!/bin/bash
set -euo pipefail

COMPOSE_FILE="infra/docker-compose.dev.yml"

cd "$(dirname "$0")/.."

usage() {
  echo "Usage: $0 {start|stop|restart|status}"
  exit 1
}

start() {
  echo "🚀 Starting SENSUAL SERVER (prod compose)..."

  # Pull external images (nginx/cloudflared). Build local images (api).
  docker compose -f "$COMPOSE_FILE" pull || true
  docker compose -f "$COMPOSE_FILE" build
  docker compose -f "$COMPOSE_FILE" up -d

  docker compose -f "$COMPOSE_FILE" ps
  echo "✅ Server started."
}

stop() {
  echo "🛑 Stopping SENSUAL SERVER..."
  docker compose -f "$COMPOSE_FILE" down
  echo "✅ Server stopped."
}

status() {
  docker compose -f "$COMPOSE_FILE" ps
}

restart() {
  stop
  start
}

case "${1:-}" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  restart)
    restart
    ;;
  status)
    status
    ;;
  *)
    usage
    ;;
esac
