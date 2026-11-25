#!/usr/bin/env bash
# Server watch (INFRA-05), every 5 minutes from cron (see server-setup.sh). Checks what a visitor and the team rely on:
#   - the site answers on its public address (APP_URL), through Caddy and TLS;
#   - the API is ready (database and Redis reachable);
#   - the disk is not nearly full;
#   - the last database backup is less than 26 hours old (production and staging alike).
# Alerts go to ALERT_WEBHOOK_URL (plain-text POST, e.g. a private https://ntfy.sh/<long-random-topic> read on a phone)
# and/or by e-mail to ALERT_EMAIL through Brevo (EMAIL_PROVIDER=brevo). One alert when a problem starts, a reminder
# every 6 hours while it lasts, one message when it is solved. Messages never contain personal data.
#   scripts/watch.sh            # run the checks (cron)
#   scripts/watch.sh --test     # send a test alert, to check the channels
set -uo pipefail
cd "$(dirname "$0")/.."
get() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- || true; }

APP_URL="$(get APP_URL)"
WEBHOOK="$(get ALERT_WEBHOOK_URL)"
ALERT_EMAIL="$(get ALERT_EMAIL)"
EMAIL_PROVIDER="$(get EMAIL_PROVIDER)"
EMAIL_API_KEY="$(get EMAIL_API_KEY)"
DISK_LIMIT="${WATCH_DISK_LIMIT:-85}"
BACKUP_MAX_HOURS="${WATCH_BACKUP_MAX_HOURS:-26}"
STATE_DIR="${WATCH_STATE_DIR:-backups}"
STATE="$STATE_DIR/.watch-state"
REMIND_SECONDS=$((6 * 3600))
HOST="$(hostname)"

json() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g'; }

send() {
  local subject="$1" body="$2" sent=0
  if [ -n "$WEBHOOK" ]; then
    # Title on the first line of the text: HTTP headers cannot carry accents reliably.
    curl -fsS --max-time 15 -H 'content-type: text/plain; charset=utf-8' --data-binary "$subject"$'\n\n'"$body" "$WEBHOOK" > /dev/null && sent=1
  fi
  if [ -n "$ALERT_EMAIL" ] && [ "$EMAIL_PROVIDER" = "brevo" ] && [ -n "$EMAIL_API_KEY" ]; then
    curl -fsS --max-time 15 https://api.brevo.com/v3/smtp/email \
      -H "api-key: $EMAIL_API_KEY" -H 'content-type: application/json' \
      -d "$(printf '{"sender":{"name":"Twabibu surveillance","email":"%s"},"to":[{"email":"%s"}],"subject":"%s","textContent":"%s"}' \
        "$(json "$ALERT_EMAIL")" "$(json "$ALERT_EMAIL")" "$(json "$subject")" "$(json "$body")")" > /dev/null && sent=1
  fi
  [ "$sent" = 1 ] || echo "$(date -u +%FT%TZ) no alert channel configured (ALERT_WEBHOOK_URL or ALERT_EMAIL): $subject" >&2
}

if [ "${1:-}" = "--test" ]; then
  send "Twabibu ($HOST) : test d’alerte" "Ceci est un essai de la surveillance du serveur. Rien à faire."
  exit 0
fi

problems=()
if [ -z "$APP_URL" ]; then
  problems+=("APP_URL absent du .env : impossible de vérifier le site")
else
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$APP_URL/" || true)"
  [ "$code" = "200" ] || problems+=("Le site ne répond pas normalement ($APP_URL : code ${code:-aucun})")
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$APP_URL/api/ready" || true)"
  [ "$code" = "200" ] || problems+=("L’API n’est pas prête : base de données ou Redis injoignable (code ${code:-aucun})")
fi

used="$(df -P / | awk 'NR==2 {gsub("%", "", $5); print $5}')"
[ -n "$used" ] && [ "$used" -ge "$DISK_LIMIT" ] && problems+=("Disque rempli à ${used} % (seuil ${DISK_LIMIT} %)")

if [ -f backups/.last-success ]; then
  last="$(date -d "$(cat backups/.last-success)" +%s 2>/dev/null || echo 0)"
  age_h=$(( ($(date +%s) - last) / 3600 ))
  [ "$age_h" -ge "$BACKUP_MAX_HOURS" ] && problems+=("Dernière sauvegarde réussie il y a ${age_h} h (voir backups/backup.log)")
elif [ -f .env ] && [ $(( $(date +%s) - $(stat -c %Y .env) )) -ge $((BACKUP_MAX_HOURS * 3600)) ]; then
  # A server set up today has not reached its first nightly backup yet: only complain after a full day.
  problems+=("Aucune sauvegarde réussie enregistrée (backups/.last-success absent)")
fi

now="$(date +%s)"
mkdir -p "$STATE_DIR"
# Read, not sourced: only these two values are taken from the file.
prev_status="$(grep -oE '^prev_status=(ok|ko)$' "$STATE" 2>/dev/null | cut -d= -f2)"
prev_sent="$(grep -oE '^prev_sent=[0-9]+$' "$STATE" 2>/dev/null | cut -d= -f2)"
prev_status="${prev_status:-ok}"; prev_sent="${prev_sent:-0}"

if [ "${#problems[@]}" -eq 0 ]; then
  if [ "$prev_status" = "ko" ]; then
    send "Twabibu ($HOST) : rétabli" "Tous les contrôles sont de nouveau bons ($(date -u '+%d/%m %H:%M') UTC)."
  fi
  printf 'prev_status=ok\nprev_sent=0\n' > "$STATE"
  exit 0
fi

body="$(printf '%s\n' "${problems[@]}")"
echo "$(date -u +%FT%TZ) ${body//$'\n'/ | }" >&2
if [ "$prev_status" = "ok" ] || [ $((now - prev_sent)) -ge "$REMIND_SECONDS" ]; then
  title="Twabibu ($HOST) : problème détecté"
  [ "$prev_status" = "ko" ] && title="Twabibu ($HOST) : problème toujours en cours"
  send "$title" "$body"
  prev_sent="$now"
fi
printf 'prev_status=ko\nprev_sent=%s\n' "$prev_sent" > "$STATE"
exit 1
