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

# ==========================
# SERVICE METHODS
# ==========================

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
      \"memoryMb\":128,
      \"internalPort\":80,
      \"healthPath\":\"/\"
    }" | jq -r '.id')

  [[ "$SERVICE_ID" == "null" ]] && exit 1
  export SERVICE_ID

  log_ok "Service created: $SERVICE_ID"
}

list_services() {
  log_info "Listing services..."
  curl -fsS "$API_URL/api/services" \
    -H "Authorization: Bearer $TOKEN" | jq
}

get_service() {
  log_info "Getting service..."
  curl -fsS "$API_URL/api/services/$SERVICE_ID" \
    -H "Authorization: Bearer $TOKEN" | jq
}

check_service_health() {
  log_info "Checking service health..."
  curl -fsS -X POST \
    "$API_URL/api/services/$SERVICE_ID/check-health" \
    -H "Authorization: Bearer $TOKEN" | jq
}

service_logs() {
  log_info "Fetching service logs..."
  curl -fsS \
    "$API_URL/api/services/$SERVICE_ID/logs?tail=50" \
    -H "Authorization: Bearer $TOKEN"
}

stop_service() {
  log_info "Stopping service..."
  curl -fsS -X POST \
    "$API_URL/api/services/$SERVICE_ID/stop" \
    -H "Authorization: Bearer $TOKEN" | jq
}

start_service() {
  log_info "Starting service..."
  curl -fsS -X POST \
    "$API_URL/api/services/$SERVICE_ID/start" \
    -H "Authorization: Bearer $TOKEN" | jq
}

delete_service() {
  log_info "Deleting service..."
  curl -fsS -X DELETE \
    "$API_URL/api/services/$SERVICE_ID" \
    -H "Authorization: Bearer $TOKEN" | jq
}

# ==========================
# COMPUTE METHODS
# ==========================

create_compute() {
  log_info "Creating compute..."

  COMPUTE_ID=$(curl -fsS -X POST "$API_URL/api/computes" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"projectId\":\"$PROJECT_ID\",
      \"cpu\":1,
      \"memoryMb\":256,
      \"image\":\"ubuntu:22.04\",
      \"username\":\"swapnil\",
      \"sshPublic\":true
    }" | jq -r '.id')

  [[ "$COMPUTE_ID" == "null" ]] && exit 1
  export COMPUTE_ID

  log_ok "Compute created: $COMPUTE_ID"
}

list_computes() {
  log_info "Listing computes..."
  curl -fsS "$API_URL/api/computes" \
    -H "Authorization: Bearer $TOKEN" | jq
}

get_compute() {
  log_info "Getting compute..."
  curl -fsS "$API_URL/api/computes/$COMPUTE_ID" \
    -H "Authorization: Bearer $TOKEN" | jq
}

stop_compute() {
  log_info "Stopping compute..."
  curl -fsS -X POST \
    "$API_URL/api/computes/$COMPUTE_ID/stop" \
    -H "Authorization: Bearer $TOKEN" | jq
}

start_compute() {
  log_info "Starting compute..."
  curl -fsS -X POST \
    "$API_URL/api/computes/$COMPUTE_ID/start" \
    -H "Authorization: Bearer $TOKEN" | jq
}

delete_compute() {
  log_info "Deleting compute..."
  curl -fsS -X DELETE \
    "$API_URL/api/computes/$COMPUTE_ID" \
    -H "Authorization: Bearer $TOKEN" | jq
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

run_service_full() {
  login
  create_team
  create_project
  create_service
  list_services
  get_service
  check_service_health
  service_logs
  # stop_service
  # start_service
  # delete_service
}


run_compute() {
  login
  create_team
  create_project
  create_compute
}

run_compute_full() {
  login
  create_team
  create_project
  create_compute
  list_computes
  get_compute
  stop_compute
  start_compute
  delete_compute
}

run_full() {
  health_check
  login
  create_team
  create_project
  create_service
  list_services
  get_service
  check_service_health
  service_logs
  stop_service
  start_service
  delete_service
  create_compute
  list_computes
  get_compute
  stop_compute
  start_compute
  delete_compute
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
  echo "8) Full service API verification"
  echo "9) Full compute API verification"
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
    8) run_service_full ;;
    9) run_compute_full ;;
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
  service-full) run_service_full ;;
  compute)  run_compute ;;
  compute-full) run_compute_full ;;
  full)     run_full ;;
  

  menu)     menu ;;
  *)
    log_error "Unknown mode: $MODE"
    echo "Valid modes: health auth team project service compute full"
    exit 1
    ;;
esac

log_ok "API verification completed"
