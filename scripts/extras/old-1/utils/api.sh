#!/bin/bash

API_BASE="${API_BASE:-http://localhost:8080}"

api_post() {
  local path="$1"
  local token="$2"
  local body="$3"

  curl -s -X POST "$API_BASE$path" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $token" \
    -d "$body"
}

api_get() {
  local path="$1"
  local token="$2"

  curl -s "$API_BASE$path" \
    -H "Authorization: Bearer $token"
}
