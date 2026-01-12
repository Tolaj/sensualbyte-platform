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