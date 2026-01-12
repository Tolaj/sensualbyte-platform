#!/bin/bash
set -euo pipefail

source scripts/utils/colors.sh

is_debian_like() {
  command -v apt-get >/dev/null 2>&1
}

need_sudo() {
  if ! command -v sudo >/dev/null 2>&1; then
    die "sudo not found. Install sudo or run as root."
  fi
}

apt_install() {
  local pkgs=("$@")
  need_sudo
  log_info "Installing packages: ${pkgs[*]}"
  sudo apt-get update -y
  sudo apt-get install -y "${pkgs[@]}"
}

ensure_cmd() {
  local cmd="$1"
  local install_hint="$2"
  if command -v "$cmd" >/dev/null 2>&1; then
    log_ok "Found: $cmd"
    return 0
  fi

  log_warn "Missing: $cmd"
  if is_debian_like; then
    # For Debian-like, caller should install via apt (we handle common ones below)
    return 1
  fi

  die "Missing required command: $cmd ($install_hint)"
}

install_node_debian() {
  # Prefer distro node if present; if too old later you can switch to NodeSource.
  if command -v node >/dev/null 2>&1; then return 0; fi
  apt_install nodejs npm
}

install_docker_debian() {
  if command -v docker >/dev/null 2>&1; then return 0; fi
  log_info "Installing Docker (debian/ubuntu)..."
  apt_install ca-certificates gnupg lsb-release

  need_sudo
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg

  local distro
  distro="$(. /etc/os-release && echo "${ID}")"
  local codename
  codename="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
  if [ -z "$codename" ]; then
    codename="$(lsb_release -cs 2>/dev/null || true)"
  fi
  [ -n "$codename" ] || die "Could not determine distro codename for Docker repo"

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${distro} ${codename} stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  # Add current user to docker group (so docker works without sudo)
  if getent group docker >/dev/null 2>&1; then
    sudo usermod -aG docker "$USER" || true
  fi

  log_ok "Docker installed."
}

install_cloudflared_debian() {
  if command -v cloudflared >/dev/null 2>&1; then return 0; fi
  log_info "Installing cloudflared (debian/ubuntu)..."

  apt_install ca-certificates gnupg lsb-release

  need_sudo
  sudo mkdir -p /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
    | sudo gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg

  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
    | sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null

  sudo apt-get update -y
  sudo apt-get install -y cloudflared

  log_ok "cloudflared installed."
}

ensure_docker_running() {
  log_info "Checking Docker daemon..."
  if docker info >/dev/null 2>&1; then
    log_ok "Docker is running."
    return 0
  fi

  # Try starting service if possible
  if command -v systemctl >/dev/null 2>&1; then
    log_warn "Docker not running. Trying: sudo systemctl start docker"
    sudo systemctl start docker || true
  elif command -v service >/dev/null 2>&1; then
    log_warn "Docker not running. Trying: sudo service docker start"
    sudo service docker start || true
  fi

  docker info >/dev/null 2>&1 || die "Docker daemon not running. Start Docker and re-run."
  log_ok "Docker is running."
}

main() {
  log_info "Checking / installing required commands..."

  if ! is_debian_like; then
    die "Auto-install currently supported only on Debian/Ubuntu/WSL (apt-get)."
  fi

  # Basic tools
  command -v curl >/dev/null 2>&1 || apt_install curl
  command -v git  >/dev/null 2>&1 || apt_install git
  command -v jq   >/dev/null 2>&1 || apt_install jq
  command -v openssl >/dev/null 2>&1 || apt_install openssl

  # Node
  install_node_debian
  command -v node >/dev/null 2>&1 || die "node not installed (unexpected after apt)."
  command -v npm  >/dev/null 2>&1 || die "npm not installed (unexpected after apt)."

  # Docker + compose plugin
  install_docker_debian
  command -v docker >/dev/null 2>&1 || die "docker not installed."
  docker compose version >/dev/null 2>&1 || die "docker compose plugin not installed."

  # Cloudflared
  install_cloudflared_debian
  command -v cloudflared >/dev/null 2>&1 || die "cloudflared not installed."

  log_ok "Core tools present."

  ensure_docker_running

  log_info "Versions:"
  git --version || true
  curl --version | head -n 1 || true
  jq --version || true
  node --version || true
  npm --version || true
  docker --version || true
  docker compose version || true
  cloudflared --version || true

  log_ok "System bootstrap completed."
}

main "$@"
