#!/bin/sh
# =============================================================================
# World Monitor — one-command self-hosted install
# =============================================================================
# Generates the required secrets, builds and starts the full stack (dashboard,
# API, Redis, AIS relay, AI Port), waits for it to come up, and seeds data.
#
# Usage:
#   ./scripts/install-worldmonitor.sh [--no-seed] [--with-subscription-clis]
#
#   --no-seed                  start the stack but skip the initial data seed
#   --with-subscription-clis   build the AI Port with the official Claude Code,
#                              Codex and Gemini CLIs so a Claude / ChatGPT /
#                              Gemini subscription can be connected
#
# Re-running is safe: existing secrets in .env are never overwritten.
# =============================================================================
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env"
SEED=true
WITH_CLIS=false

for arg in "$@"; do
  case "$arg" in
    --no-seed) SEED=false ;;
    --with-subscription-clis) WITH_CLIS=true ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

say() { printf '\033[1m==> %s\033[0m\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# ── Prerequisites ────────────────────────────────────────────────────────────
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v podman-compose >/dev/null 2>&1; then
  COMPOSE="podman-compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  die "Docker Compose (or podman-compose) is required: https://docs.docker.com/get-docker/"
fi
command -v node >/dev/null 2>&1 || die "Node.js 22+ is required for the data seeders: https://nodejs.org"
command -v openssl >/dev/null 2>&1 || die "openssl is required to generate secrets"

# ── Secrets ──────────────────────────────────────────────────────────────────
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

ensure_secret() {
  name="$1"; value="$2"
  if ! grep -qE "^${name}=.+" "$ENV_FILE"; then
    # Drop an empty placeholder line, then append the generated value.
    tmp="$(mktemp)"; grep -vE "^${name}=[[:space:]]*$" "$ENV_FILE" > "$tmp" || true; cat "$tmp" > "$ENV_FILE"; rm -f "$tmp"
    printf '%s=%s\n' "$name" "$value" >> "$ENV_FILE"
    echo "    generated $name"
  fi
}

say "Preparing secrets in .env"
ensure_secret RELAY_SHARED_SECRET "$(openssl rand -hex 32)"
ensure_secret REDIS_PASSWORD "$(openssl rand -hex 32)"
ensure_secret REDIS_TOKEN "$(openssl rand -hex 32)"
ensure_secret WM_SESSION_SECRET "$(openssl rand -hex 32)"
ensure_secret WORLDMONITOR_RELAY_KEY "$(openssl rand -hex 32)"
ensure_secret WORLDMONITOR_VALID_KEYS "wm_$(openssl rand -hex 20)"
ensure_secret AI_PORT_TOKEN "aip_$(openssl rand -hex 24)"
ensure_secret AI_PORT_ADMIN_TOKEN "aipadmin_$(openssl rand -hex 24)"
if [ "$WITH_CLIS" = true ]; then
  ensure_secret AI_PORT_INSTALL_CLIS true
fi

# ── Host dependencies for seeders ────────────────────────────────────────────
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  say "Installing Node dependencies (for host-side seeders)"
  (cd "$PROJECT_DIR" && npm ci --no-audit --no-fund)
fi

# ── Build and start ──────────────────────────────────────────────────────────
say "Building and starting the stack (first build takes several minutes)"
(cd "$PROJECT_DIR" && $COMPOSE up -d --build)

WM_PORT="$(grep -E '^WM_PORT=' "$ENV_FILE" | tail -1 | cut -d= -f2-)"; WM_PORT="${WM_PORT:-3000}"
AI_PORT_PORT="$(grep -E '^AI_PORT_PORT=' "$ENV_FILE" | tail -1 | cut -d= -f2-)"; AI_PORT_PORT="${AI_PORT_PORT:-8787}"

say "Waiting for the dashboard on http://localhost:$WM_PORT"
i=0
until curl -fsS -o /dev/null "http://localhost:$WM_PORT/" 2>/dev/null; do
  i=$((i + 1))
  [ "$i" -gt 90 ] && die "World Monitor did not come up within 3 minutes. Check: $COMPOSE logs worldmonitor"
  sleep 2
done
curl -fsS -o /dev/null "http://localhost:$AI_PORT_PORT/health" 2>/dev/null \
  || echo "    warning: AI Port is not answering yet — check: $COMPOSE logs ai-port"

# ── Seed ─────────────────────────────────────────────────────────────────────
if [ "$SEED" = true ]; then
  say "Seeding data (this can take a while; safe to re-run any time)"
  "$SCRIPT_DIR/run-seeders.sh" || echo "    some seeders failed or were skipped — usually a missing optional API key"
fi

ADMIN_TOKEN="$(grep -E '^AI_PORT_ADMIN_TOKEN=' "$ENV_FILE" | tail -1 | cut -d= -f2-)"
cat <<EOF

World Monitor is running.

  Dashboard     http://localhost:$WM_PORT
  AI Port       http://localhost:$AI_PORT_PORT   (connect any AI here)
  Admin token   $ADMIN_TOKEN    (also in .env as AI_PORT_ADMIN_TOKEN)

Next steps
  1. Open the AI Port and add your AI: paste an API key (Anthropic, OpenAI,
     Gemini, Groq, Mistral, DeepSeek, xAI, OpenRouter, Azure, ...), point it at
     a local model (Ollama, LM Studio), or connect a subscription.
  2. Add data-source keys to .env for more feeds (see SELF_HOSTING.md), then
     run: $COMPOSE up -d && ./scripts/run-seeders.sh
  3. Keep data fresh: add ./scripts/run-seeders.sh to cron (every 30 min).
EOF
