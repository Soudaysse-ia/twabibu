#!/usr/bin/env bash
# Goes back to the previous image tag. Migrations are not undone: they are always backward compatible
# (expand, then contract in a later release), so the previous code runs on the new schema.
set -euo pipefail
cd "$(dirname "$0")/.."
PREVIOUS="${1:-$(cat .previous-tag 2>/dev/null || true)}"
[ -n "$PREVIOUS" ] || { echo "No previous tag: pass one, e.g. ./scripts/rollback.sh v0.1.0"; exit 1; }
CURRENT="$(grep -E '^TAG=' .env | cut -d= -f2-)"
echo "Rollback ${CURRENT} -> ${PREVIOUS}"
sed -i "s/^TAG=.*/TAG=${PREVIOUS}/" .env
docker compose pull --quiet api web admin
docker compose up -d --wait --remove-orphans
echo "$CURRENT" > .previous-tag
echo "$PREVIOUS $(date -u +%Y-%m-%dT%H:%M:%SZ) rollback" >> deployments.log
echo "Done. Back on ${PREVIOUS}."
