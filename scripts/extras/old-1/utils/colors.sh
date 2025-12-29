#!/bin/bash

RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
BOLD="\033[1m"
RESET="\033[0m"

log_info() {
  echo -e "${BLUE}ℹ️  $1${RESET}"
}

log_success() {
  echo -e "${GREEN}✅ $1${RESET}"
}

log_warn() {
  echo -e "${YELLOW}⚠️  $1${RESET}"
}

log_error() {
  echo -e "${RED}❌ $1${RESET}"
}
