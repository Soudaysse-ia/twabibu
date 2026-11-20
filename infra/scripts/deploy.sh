#!/usr/bin/env bash
# Deploys one image tag on this server (runbook: docs/03-architecture/runbooks/deploiement.md).
#   ./scripts/deploy.sh v0.2.0      production
#   ./scripts/deploy.sh sha-1a2b3c4 staging
# Order: pull, backup (production), migrations, restart, wait for health checks. Stops at the first error;
# if the new release fails its health checks, the previous one is started again.
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
  docker compose logs --tail 50 api web admin > "deploy-failure-$(date -u +%Y%m%dT%H%M%SZ).log" 2>&1 || true
  if [ -n "$OLD_TAG" ] && [ "$OLD_TAG" != "$NEW_TAG" ]; then
    # Migrations are backward compatible (runbooks/deploiement.md): the previous release runs on the new schema.
    log "health checks failed: going back to ${OLD_TAG} (logs saved in deploy-failure-*.log)"
    set_tag "$OLD_TAG"
    docker compose up -d --wait --remove-orphans || log "the previous release does not start either: see the logs"
    echo "$NEW_TAG $(date -u +%Y-%m-%dT%H:%M:%SZ) failed, back on ${OLD_TAG}" >> deployments.log
  else
    log "health checks failed (logs saved in deploy-failure-*.log)"
  fi
  exit 1
fi
[ -n "$OLD_TAG" ] && [ "$OLD_TAG" != "$NEW_TAG" ] && echo "$OLD_TAG" > .previous-tag
echo "$NEW_TAG $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> deployments.log
docker image prune -af --filter "until=336h" > /dev/null || true
log "done: ${NEW_TAG}"
