#!/usr/bin/env bash
set -euo pipefail

API_URL="http://localhost:8080"
EMAIL="admin@sensualbyte.com"
PASSWORD="Admin@123"

source scripts/utils/colors.sh

require() {
  command -v "$1" >/dev/null 2>&1 || {
    log_error "Missing dependency: $1"
    exit 1
  }
}

require curl
require jq

# ==========================
# CORE ACTIONS
# ==========================
health_check() {
  curl -fsS "$API_URL/api/health" >/dev/null
  log_ok "API health endpoint OK"
}

login() {
  log_info "Logging in..."

  RESPONSE=$(curl -fsS -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

  TOKEN=$(echo "$RESPONSE" | jq -r '.token')

  [[ -z "$TOKEN" || "$TOKEN" == "null" ]] && {
    log_error "Login failed"
    exit 1
  }

  export TOKEN
  log_ok "Login OK"
}

create_team() {
  log_info "Creating team..."

  TEAM_ID=$(curl -fsS -X POST "$API_URL/api/teams" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{ "name": "Verify Team" }' | jq -r '.id')

  [[ "$TEAM_ID" == "null" ]] && exit 1
  export TEAM_ID
  log_ok "Team created: $TEAM_ID"
}

create_project() {
  log_info "Creating project..."

  PROJECT_ID=$(curl -fsS -X POST "$API_URL/api/projects" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Verify Project\",\"teamId\":\"$TEAM_ID\"}" | jq -r '.id')

  [[ "$PROJECT_ID" == "null" ]] && exit 1
  export PROJECT_ID
  log_ok "Project created: $PROJECT_ID"
}

create_service() {
  log_info "Creating service..."

  SERVICE_ID=$(curl -fsS -X POST "$API_URL/api/services" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\":\"verify-service\",
      \"projectId\":\"$PROJECT_ID\",
      \"image\":\"nginx:alpine\",
      \"cpu\":1,
      \"memoryMb\":128
    }" | jq -r '.id')

  [[ "$SERVICE_ID" == "null" ]] && exit 1
  log_ok "Service created: $SERVICE_ID"
}

create_compute() {
  log_info "Creating compute..."

  COMPUTE_ID=$(curl -fsS -X POST "$API_URL/api/computes" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"projectId\":\"$PROJECT_ID\",
      \"cpu\":1,
      \"memoryMb\":256,
      \"image\":\"ubuntu:22.04\"
    }" | jq -r '.id')

  [[ "$COMPUTE_ID" == "null" ]] && exit 1
  log_ok "Compute created: $COMPUTE_ID"
}

# ==========================
# RUN MODES
# ==========================
run_health() {
  health_check
}

run_auth() {
  login
}

run_team() {
  login
  create_team
}

run_project() {
  login
  create_team
  create_project
}

run_service() {
  login
  create_team
  create_project
  create_service
}

run_compute() {
  login
  create_team
  create_project
  create_compute
}

run_full() {
  health_check
  login
  create_team
  create_project
  create_service
  create_compute
}

# ==========================
# MENU
# ==========================
menu() {
  echo ""
  log_info "API Verification Menu"
  echo "--------------------------------"
  echo "1) Health check"
  echo "2) Auth (login)"
  echo "3) Team creation"
  echo "4) Project creation"
  echo "5) Service creation"
  echo "6) Compute creation"
  echo "7) Full API verification"
  echo "q) Quit"
  echo ""
  read -rp "> " CHOICE

  case "$CHOICE" in
    1) run_health ;;
    2) run_auth ;;
    3) run_team ;;
    4) run_project ;;
    5) run_service ;;
    6) run_compute ;;
    7) run_full ;;
    q|Q) exit 0 ;;
    *) log_error "Invalid option" ;;
  esac
}

# ==========================
# ENTRYPOINT
# ==========================
MODE="${1:-menu}"

case "$MODE" in
  health)   run_health ;;
  auth)     run_auth ;;
  team)     run_team ;;
  project)  run_project ;;
  service)  run_service ;;
  compute)  run_compute ;;
  full)     run_full ;;
  menu)     menu ;;
  *)
    log_error "Unknown mode: $MODE"
    echo "Valid modes: health auth team project service compute full"
    exit 1
    ;;
esac

log_ok "API verification completed"
