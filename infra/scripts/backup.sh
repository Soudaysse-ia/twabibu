#!/usr/bin/env bash
# Daily database backup (cron 02:30 UTC, see server-setup.sh). Keeps 14 days on the server and, when configured,
# sends an encrypted copy off the server (age + rclone): a backup on the same disk is not a backup.
set -euo pipefail
cd "$(dirname "$0")/.."
get() { grep -E "^$1=" .env | cut -d= -f2- || true; }
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="backups/twabibu-${STAMP}.dump"
mkdir -p backups
chmod 700 backups
docker compose exec -T postgres pg_dump -U twabibu -d twabibu --format=custom --compress=9 > "${FILE}.partial"
mv "${FILE}.partial" "$FILE"
# A dump that pg_restore cannot list is not a backup.
docker compose exec -T postgres pg_restore --list < "$FILE" > /dev/null
echo "backup ${FILE} ($(du -h "$FILE" | cut -f1))"

REMOTE="$(get BACKUP_RCLONE_REMOTE)"
RECIPIENT="$(get BACKUP_AGE_RECIPIENT)"
if [ -n "$REMOTE" ] && [ -n "$RECIPIENT" ]; then
  age -r "$RECIPIENT" -o "${FILE}.age" "$FILE"
  rclone copy "${FILE}.age" "$REMOTE" --quiet
  rm -f "${FILE}.age"
  echo "off-site copy sent to ${REMOTE}"
else
  echo "WARNING: no off-site copy (set BACKUP_RCLONE_REMOTE and BACKUP_AGE_RECIPIENT in .env)" >&2
fi

find backups -name 'twabibu-*.dump' -mtime +14 -delete
date -u +%Y-%m-%dT%H:%M:%SZ > backups/.last-success
