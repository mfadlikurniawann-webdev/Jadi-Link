#!/usr/bin/env bash
# Deploys the latest origin/main (Nest API + Next.js dashboard) on the VPS.
# Usage (as the app user, from anywhere): deploy/scripts/deploy.sh
# Env: APP_DIR (default: repository containing this script), BRANCH (main),
#      HEALTH_URL (http://127.0.0.1:3001/api/health),
#      WEB_URL (http://127.0.0.1:3000/).
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$script_dir/../.." && pwd)}"
BRANCH="${BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/health}"
WEB_URL="${WEB_URL:-http://127.0.0.1:3000/}"

cd "$APP_DIR"

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Tracked files changed on the server; refusing to deploy over them." >&2
  exit 1
fi

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$node_major" != "24" ]]; then
  echo "Node 24 LTS is required (found $(node -v))." >&2
  exit 1
fi

cd backend
if [[ ! -f .env ]]; then
  echo "backend/.env is missing. Copy deploy/env/backend.production.env.example and fill it in." >&2
  exit 1
fi
if ! grep -qE '^NODE_ENV=production$' .env; then
  echo "backend/.env must contain NODE_ENV=production." >&2
  exit 1
fi
# The dashboard calls the API on the same public origin as the short links.
short_link_base="$(sed -n 's/^SHORT_LINK_BASE_URL=//p' .env | tail -n 1 | tr -d "\"'\r")"
if [[ ! "$short_link_base" =~ ^https://[^/?#]+/?$ ]]; then
  echo "backend/.env SHORT_LINK_BASE_URL must be https://host (found '$short_link_base')." >&2
  exit 1
fi
api_url="${short_link_base%/}/api"
cd "$APP_DIR"

git fetch --prune origin "$BRANCH"
git checkout "$BRANCH"
git merge --ff-only "origin/$BRANCH"
echo "Deploying $(git rev-parse --short HEAD)"

cd backend
npm ci
# "build" runs prisma generate + nest build.
npm run build
# Applies committed migrations only (never "migrate dev" in production).
npm run prisma:deploy
# The Prisma CLI is a runtime dependency, so it survives the prune.
npm prune --omit=dev
cd "$APP_DIR"

cd frontend
npm ci
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time.
NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_API_URL="$api_url" npm run build
cd "$APP_DIR"

pm2 startOrReload deploy/pm2/ecosystem.config.cjs --update-env
pm2 save

wait_for() {
  local name="$1" url="$2" app="$3" attempt
  for attempt in $(seq 1 20); do
    if curl -fsS --max-time 5 -o /dev/null "$url"; then
      echo "$name is up."
      return 0
    fi
    sleep 1
    echo "Waiting for the $name ($attempt/20)..."
  done
  echo "$name health check failed. Inspect: pm2 logs $app --lines 100" >&2
  return 1
}

wait_for API "$HEALTH_URL" jadi-link-api
wait_for dashboard "$WEB_URL" jadi-link-web
echo "Deployed $(git rev-parse --short HEAD); dashboard uses $api_url"
