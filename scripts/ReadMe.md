### `scripts/install.sh` — usage

#### Basic
```bash
bash scripts/install.sh
```
#### Choose mode
```bash
# Production install (uses infra/docker-compose.prod.yml)
bash scripts/install.sh --prod

# Development install (uses infra/docker-compose.dev.yml)
bash scripts/install.sh --dev
```
#### Non-interactive flags
```bash
# Auto-confirm all prompts
bash scripts/install.sh --yes
bash scripts/install.sh -y

# Use default values for all prompts
bash scripts/install.sh --defaults
bash scripts/install.sh -d

# Fully unattended (defaults + auto-yes)
bash scripts/install.sh --prod --defaults --yes
bash scripts/install.sh --dev  -d -y
```
#### Typical flows
```bash
# First-time prod setup, interactive
bash scripts/install.sh --prod

# CI / unattended prod setup
bash scripts/install.sh --prod -d -y

# Local dev stack, unattended
bash scripts/install.sh --dev -d -y

```sh
# Uninstall — all ways (copy/paste)

# 0) (Optional) make scripts executable once
chmod +x scripts/uninstall.sh scripts/uninstall/platform.sh scripts/uninstall/cloudflare.sh

# 1) Normal interactive uninstall (prompts for each step)
./scripts/uninstall.sh

# 2) Auto-yes (non-interactive: answers YES to ALL prompts)
./scripts/uninstall.sh --yes
./scripts/uninstall.sh -y

# 3) Defaults mode (uses default values for any prompt() calls)
./scripts/uninstall.sh --defaults
./scripts/uninstall.sh -d

# 4) Auto-yes + defaults (most automation-friendly)
./scripts/uninstall.sh --yes --defaults
./scripts/uninstall.sh -y -d

```

```sh
# Full verification (prod is default)
./scripts/verify.sh

# Full verification for DEV
./scripts/verify.sh --dev

# Only check docker containers (DEV)
./scripts/verify.sh --dev docker

# Only check nginx (PROD)
./scripts/verify.sh --prod nginx

# Only run API smoke test (DEV)
./scripts/verify.sh --dev api

# Check Cloudflare public route (PROD)
./scripts/verify.sh --prod cloudflare

# Non-interactive full verify (DEV)
./scripts/verify.sh --dev --yes full

```