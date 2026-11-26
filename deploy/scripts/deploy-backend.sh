#!/usr/bin/env bash
# Deploys the latest origin/main backend on the VPS.
# Usage (as the app user, from anywhere): deploy/scripts/deploy-backend.sh
# Env: APP_DIR (default: repository containing this script), BRANCH (main),
#      HEALTH_URL (http://127.0.0.1:3001/api/health).
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$script_dir/../.." && pwd)}"
BRANCH="${BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/health}"

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

pm2 startOrReload deploy/pm2/ecosystem.config.cjs --update-env
pm2 save

for attempt in $(seq 1 20); do
  if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null; then
    echo "Health check passed."
    exit 0
  fi
  sleep 1
  echo "Waiting for the API ($attempt/20)..."
done

echo "Health check failed. Inspect: pm2 logs jadi-link-api --lines 100" >&2
exit 1
