#!/usr/bin/env bash
# API errors of the last hours (INFRA-05), read from the Docker logs (JSON lines, 10 MB × 5 files kept per service).
#   scripts/errors.sh            # last 24 hours
#   scripts/errors.sh 2h         # last 2 hours
#   scripts/errors.sh 24h a1b2c3d4   # what happened to one request (the reference a user gives the support)
# The logs hold no personal data: no query string, no body, route templates only (apps/api/src/common/request-log.ts).
set -euo pipefail
cd "$(dirname "$0")/.."
SINCE="${1:-24h}"
REF="${2:-}"
if [ -n "$REF" ]; then
  [[ "$REF" =~ ^[A-Za-z0-9-]{4,64}$ ]] || { echo "invalid reference: $REF" >&2; exit 2; }
  docker compose logs --no-color --no-log-prefix --since "$SINCE" api | grep -F "id=$REF" || echo "nothing for $REF in the last $SINCE"
  exit 0
fi
docker compose logs --no-color --no-log-prefix --since "$SINCE" api | grep -E '"level":"(error|fatal)"' || echo "no API error in the last $SINCE"
