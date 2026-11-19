#!/usr/bin/env bash
# Deploys one image tag on this server (runbook: docs/03-architecture/runbooks/deploiement.md).
#   ./scripts/deploy.sh v0.2.0      production
#   ./scripts/deploy.sh sha-1a2b3c4 staging
# Order: pull, backup (production), migrations, restart, wait for health checks. Stops at the first error.
set -euo pipefail
cd "$(dirname "$0")/.."
NEW_TAG="${1:?usage: deploy.sh <image-tag>}"
APP_ENV="$(grep -E '^APP_ENV=' .env | cut -d= -f2-)"
OLD_TAG="$(grep -E '^TAG=' .env | cut -d= -f2- || true)"

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
set_tag() { if grep -qE '^TAG=' .env; then sed -i "s/^TAG=.*/TAG=$1/" .env; else echo "TAG=$1" >> .env; fi; }

log "environment ${APP_ENV}, ${OLD_TAG:-none} -> ${NEW_TAG}"
set_tag "$NEW_TAG"
if ! docker compose pull --quiet api web admin; then set_tag "$OLD_TAG"; log "pull failed, nothing changed"; exit 1; fi

docker compose up -d --wait postgres redis
if [ "$APP_ENV" = "production" ]; then
  log "backup before migrations"
  ./scripts/backup.sh
fi

log "migrations"
docker compose run --rm --no-deps api node_modules/prisma/build/index.js migrate deploy

if [ "$APP_ENV" = "staging" ]; then
  # Hosted demo: reference data and fictional demo data (only rows that are missing).
  log "demo seed"
  docker compose run --rm --no-deps api node_modules/tsx/dist/cli.mjs prisma/seed.ts
fi

log "restart"
if ! docker compose up -d --wait --remove-orphans; then
  log "health checks failed: see « docker compose logs api web admin ». Roll back with ./scripts/rollback.sh"
  exit 1
fi
[ -n "$OLD_TAG" ] && [ "$OLD_TAG" != "$NEW_TAG" ] && echo "$OLD_TAG" > .previous-tag
echo "$NEW_TAG $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> deployments.log
docker image prune -af --filter "until=336h" > /dev/null || true
log "done: ${NEW_TAG}"
