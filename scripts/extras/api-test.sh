#!/bin/sh
set -e

API_URL="http://localhost:8080"
EMAIL="admin@sensualbyte.com"
PASSWORD="Admin@123"

echo "=============================="
echo " SensualByte Platform Tester "
echo "=============================="

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "❌ Missing dependency: $1"
    exit 1
  }
}

require curl
require jq
require docker

# ==========================
# PHASE 1 — LOGIN
# ==========================
login() {
  echo "🔐 Logging in..."

  RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

  TOKEN=$(echo "$RESPONSE" | jq -r '.token')

  if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "❌ Login failed"
    echo "$RESPONSE"
    exit 1
  fi

  export TOKEN
  echo "✅ Logged in"
}

# ==========================
# PHASE 4 — TEAM → PROJECT
# ==========================
create_team() {
  echo "👥 Creating team..."

  TEAM_ID=$(curl -s -X POST "$API_URL/api/teams" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{ "name": "Platform Team" }' | jq -r '.id')

  [ "$TEAM_ID" = "null" ] && exit 1

  export TEAM_ID
  echo "✅ Team: $TEAM_ID"
}

create_project() {
  echo "📦 Creating project..."

  PROJECT_ID=$(curl -s -X POST "$API_URL/api/projects" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Test Project\",\"teamId\":\"$TEAM_ID\"}" | jq -r '.id')

  [ "$PROJECT_ID" = "null" ] && exit 1

  export PROJECT_ID
  echo "✅ Project: $PROJECT_ID"
}

# ==========================
# PHASE 5 — SERVICE
# ==========================
create_service() {
  echo "🛠 Creating service..."

  SERVICE_ID=$(curl -s -X POST "$API_URL/api/services" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\":\"hello-service\",
      \"projectId\":\"$PROJECT_ID\",
      \"image\":\"nginx:alpine\",
      \"cpu\":1,
      \"memoryMb\":256
    }" | jq -r '.id')

  [ "$SERVICE_ID" = "null" ] && exit 1

  export SERVICE_ID
  echo "✅ Service: $SERVICE_ID"
}

verify_service() {
  echo "🐳 Verifying service container..."
  docker ps | grep "svc_$SERVICE_ID" >/dev/null
  echo "✅ Service container running"
}

# ==========================
# PHASE 6 — NGINX
# ==========================
reload_nginx() {
  echo "🌐 Reloading Nginx..."
  ./scripts/reload-nginx.sh
}

test_path_routing() {
  echo "🔗 Testing path routing..."
  curl -s "$API_URL/services/$SERVICE_ID/" | head -n 5
}

# ==========================
# PHASE 7 — COMPUTE
# ==========================
create_compute() {
  echo "🧠 Creating compute..."

  COMPUTE_ID=$(curl -s -X POST "$API_URL/api/computes" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"projectId\":\"$PROJECT_ID\",
      \"cpu\":1,
      \"memoryMb\":512,
      \"image\":\"ubuntu:22.04\"
    }" | jq -r '.id')

  [ "$COMPUTE_ID" = "null" ] && exit 1

  export COMPUTE_ID
  echo "✅ Compute: $COMPUTE_ID"
}

verify_compute() {
  echo "🧪 Verifying compute container..."
  docker ps | grep "cmp_$COMPUTE_ID" >/dev/null
  echo "✅ Compute container running"
}

# ==========================
# PHASE 8 — FAILURE TESTS
# ==========================
restart_api() {
  echo "🔁 Restarting API..."
  docker compose -f infra/docker-compose.yml restart api
  sleep 5
}

verify_recovery() {
  echo "🩺 Verifying recovery..."

  curl -s "$API_URL/api/health" | jq .
  docker ps | grep "svc_$SERVICE_ID" >/dev/null
  echo "✅ API recovered, services intact"
}

# ==========================
# MENU
# ==========================
echo ""
echo "Choose test:"
echo "1) Login"
echo "2) Team → Project"
echo "3) Service lifecycle"
echo "4) Full platform test"
echo "5) Compute test"
echo "6) Failure + recovery test"
read -p "> " CHOICE

case "$CHOICE" in
  1) login ;;
  2) login && create_team && create_project ;;
  3) login && create_team && create_project && create_service && verify_service ;;
  4)
    login
    create_team
    create_project
    create_service
    verify_service
    reload_nginx
    test_path_routing
    ;;
  5)
    login
    create_team
    create_project
    create_compute
    verify_compute
    ;;
  6)
    login
    restart_api
    verify_recovery
    ;;
  *) echo "❌ Invalid option" ;;
esac

echo "🎉 Test completed"
