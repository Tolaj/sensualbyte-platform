#!/usr/bin/env bash
set -euo pipefail

# -----------------------------
# Sensualbyte API Smoke Test
# -----------------------------
# PROD (via nginx): http://localhost:8080/api
# DEV  (direct):    http://localhost:3001
#
# Usage:
#   ./scripts/verify/api-smoke.sh --prod
#   ./scripts/verify/api-smoke.sh --dev
#   API_BASE=http://localhost:8080/api USER_ID=user_superadmin ./scripts/verify/api-smoke.sh
#   SKIP_COMPUTE=1 ./scripts/verify/api-smoke.sh --prod
# -----------------------------

API_BASE="${API_BASE:-http://localhost:8080/api}"
USER_ID="${USER_ID:-user_superadmin}"
SKIP_COMPUTE="${SKIP_COMPUTE:-0}"

for arg in "$@"; do
  case "$arg" in
    --dev)  API_BASE="http://localhost:3001" ;;
    --prod) API_BASE="http://localhost:8080/api" ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/utils/colors.sh"

require() { command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"; }
require curl
require jq

log_info "API_BASE=$API_BASE"
log_info "USER_ID=$USER_ID"

hdr_auth=(-H "x-user-id: ${USER_ID}")
hdr_json=(-H "content-type: application/json")

get() { curl -fsS "$API_BASE$1" "${hdr_auth[@]}"; }
post() { curl -fsS -X POST "$API_BASE$1" "${hdr_auth[@]}" "${hdr_json[@]}" -d "$2"; }

health() {
  curl -fsS "$API_BASE/healthz" >/dev/null
  log_ok "API /healthz OK"
}

wait_ready() {
  local res_id="$1"
  local timeout="${2:-120}"
  local start now state

  start="$(date +%s)"
  while true; do
    state="$(curl -fsS "$API_BASE/v1/resources/$res_id" "${hdr_auth[@]}" | jq -r '.status.state // empty')"
    if [ "$state" = "ready" ]; then
      log_ok "Resource $res_id ready"
      return 0
    fi

    now="$(date +%s)"
    if [ $((now - start)) -ge "$timeout" ]; then
      log_error "Timeout waiting for $res_id to be ready (last state: ${state:-none})"
      curl -sS "$API_BASE/v1/resources/$res_id" "${hdr_auth[@]}" | jq '.status'
      return 1
    fi
    sleep 2
  done
}

# ---- main ----

health

# identity is protected by requireAuth() -> must include x-user-id
get "/v1/identity/iam/roles" >/dev/null
log_ok "Identity auth OK (/v1/identity/iam/roles)"

# Create Team
TEAM_NAME="smoke-team-$(date +%s)"
TEAM_JSON="$(post "/v1/identity/teams" "{\"name\":\"$TEAM_NAME\"}")"
TEAM_ID="$(echo "$TEAM_JSON" | jq -r '.team.teamId')"
[ -n "$TEAM_ID" ] && [ "$TEAM_ID" != "null" ] || die "Failed to create team"
log_ok "Team created: $TEAM_ID"

# Create Project
PROJ_NAME="smoke-proj-$(date +%s)"
PROJ_JSON="$(post "/v1/projects" "{\"teamId\":\"$TEAM_ID\",\"name\":\"$PROJ_NAME\"}")"
PROJECT_ID="$(echo "$PROJ_JSON" | jq -r '.project.projectId')"
[ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ] || die "Failed to create project"
log_ok "Project created: $PROJECT_ID"

# Create Volume (catalogId must match your seeded catalog)
VOL_JSON="$(post "/v1/resources" "{
  \"projectId\":\"$PROJECT_ID\",
  \"catalogId\":\"persistent_volume\",
  \"name\":\"pv-smoke\",
  \"overrides\": { \"name\":\"pv-smoke\", \"sizeMb\": 128 }
}")"
VOL_ID="$(echo "$VOL_JSON" | jq -r '.resource.resourceId')"
[ -n "$VOL_ID" ] && [ "$VOL_ID" != "null" ] || die "Failed to create volume resource"
log_ok "Volume resource created: $VOL_ID"
wait_ready "$VOL_ID" 120

# Create Bucket
BUCKET_NAME="smoke-bkt-${PROJECT_ID//_/-}"
BKT_JSON="$(post "/v1/resources" "{
  \"projectId\":\"$PROJECT_ID\",
  \"catalogId\":\"object_bucket\",
  \"name\":\"bucket-smoke\",
  \"overrides\": {
    \"bucketName\":\"$BUCKET_NAME\",
    \"versioning\": false,
    \"publicRead\": false
  }
}")"
BKT_ID="$(echo "$BKT_JSON" | jq -r '.resource.resourceId')"
[ -n "$BKT_ID" ] && [ "$BKT_ID" != "null" ] || die "Failed to create bucket resource"
log_ok "Bucket resource created: $BKT_ID"
wait_ready "$BKT_ID" 120

# Optional: Compute (SSH box) - waits until SSH port appears in status
if [ "$SKIP_COMPUTE" = "1" ]; then
  log_warn "SKIP_COMPUTE=1 -> skipping compute test"
else
  COMP_JSON="$(post "/v1/resources" "{
    \"projectId\":\"$PROJECT_ID\",
    \"catalogId\":\"compute_instance\",
    \"name\":\"ssh-box-smoke\",
    \"overrides\": {
      \"mode\": \"iaas\",
      \"image\": \"linuxserver/openssh-server:latest\",
      \"iaas\": { \"sshUser\": \"ubuntu\" },
      \"network\": { \"internalPort\": 2222 }
    }
  }")"
  COMP_ID="$(echo "$COMP_JSON" | jq -r '.resource.resourceId')"
  [ -n "$COMP_ID" ] && [ "$COMP_ID" != "null" ] || die "Failed to create compute resource"
  log_ok "Compute resource created: $COMP_ID"

  wait_ready "$COMP_ID" 180

  SSH_PORT="$(curl -fsS "$API_BASE/v1/resources/$COMP_ID" "${hdr_auth[@]}" | jq -r '.status.details.ssh.port // empty')"
  SSH_USER="$(curl -fsS "$API_BASE/v1/resources/$COMP_ID" "${hdr_auth[@]}" | jq -r '.status.details.ssh.user // empty')"

  if [ -n "$SSH_PORT" ] && [ -n "$SSH_USER" ]; then
    log_ok "Compute SSH endpoint exposed: ${SSH_USER}@localhost:${SSH_PORT}"
    log_info "Next step (manual): decrypt secret -> write private key -> ssh -i key -p ${SSH_PORT} ${SSH_USER}@localhost"
  else
    log_warn "Compute ready but SSH details missing in status.details.ssh"
    curl -sS "$API_BASE/v1/resources/$COMP_ID" "${hdr_auth[@]}" | jq '.status.details'
  fi
fi

log_ok "API smoke test completed successfully"
