#!/usr/bin/env bash
# Restores a dump. Two modes:
#   ./scripts/restore.sh --test backups/twabibu-….dump   restores into a scratch database, checks it, drops it (monthly test)
#   ./scripts/restore.sh backups/twabibu-….dump          REPLACES the live database (incident only; site stopped meanwhile)
set -euo pipefail
cd "$(dirname "$0")/.."
MODE=live
if [ "${1:-}" = "--test" ]; then MODE=test; shift; fi
FILE="${1:?usage: restore.sh [--test] <file.dump>}"
[ -f "$FILE" ] || { echo "No such file: $FILE"; exit 1; }
psql() { docker compose exec -T postgres psql -U twabibu -v ON_ERROR_STOP=1 "$@"; }

if [ "$MODE" = test ]; then
  psql -d postgres -c 'DROP DATABASE IF EXISTS twabibu_restore_test' -c 'CREATE DATABASE twabibu_restore_test'
  docker compose exec -T postgres pg_restore -U twabibu -d twabibu_restore_test --no-owner < "$FILE"
  psql -d twabibu_restore_test -At -c 'SELECT count(*) || '' users, '' || (SELECT count(*) FROM "Appointment") || '' appointments, '' || (SELECT count(*) FROM "_prisma_migrations") || '' migrations'' FROM "User"'
  psql -d postgres -c 'DROP DATABASE twabibu_restore_test'
  date -u +%Y-%m-%dT%H:%M:%SZ > backups/.last-restore-test
  echo "Restore test OK: ${FILE}"
  exit 0
fi

read -r -p "This REPLACES the live database with ${FILE}. Type the domain name to confirm: " ANSWER
[ "$ANSWER" = "$(grep -E '^SITE_DOMAIN=' .env | cut -d= -f2-)" ] || { echo "Cancelled."; exit 1; }
./scripts/backup.sh
docker compose stop api web admin
psql -d postgres -c 'DROP DATABASE twabibu WITH (FORCE)' -c 'CREATE DATABASE twabibu OWNER twabibu'
docker compose exec -T postgres pg_restore -U twabibu -d twabibu --no-owner < "$FILE"
docker compose up -d --wait
echo "Restored ${FILE}. Check the site, then tell the team."
