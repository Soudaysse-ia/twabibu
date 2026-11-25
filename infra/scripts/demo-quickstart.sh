#!/usr/bin/env bash
# Turns a fresh Ubuntu 24.04 server into the hosted Twabibu demo (staging, ADR-020), in one command, as root:
#   curl -fsSL https://raw.githubusercontent.com/Soudaysse-ia/twabibu/main/infra/scripts/demo-quickstart.sh -o quickstart.sh
#   less quickstart.sh   # read it first
#   bash quickstart.sh
# or paste the cloud-init snippet of docs/03-architecture/runbooks/demo-en-ligne.md when creating the server.
#
# Without a domain, the demo answers on https://<ip-with-dashes>.sslip.io (a free public DNS name that points to the
# server's address; Caddy gets a real certificate for it). With DNS ready: DEMO_DOMAIN=staging.twabibu.km bash ...
# Fictional data only, codes always 000000, nothing is e-mailed. Running it again keeps .env and redeploys.
#
# Options (environment variables):
#   DEMO_DOMAIN   site address (default: <ip>.sslip.io); the back-office is admin.<DEMO_DOMAIN>
#   ADMIN_IPS     addresses allowed on the back-office, space-separated (default: nobody, 127.0.0.1/32)
#   TWABIBU_REF   git branch or tag the files are taken from (default: main)
#   TWABIBU_DIR   install folder (default: /srv/twabibu)
#   SOURCE_DIR    take the files from this checkout instead of GitHub (tests)
#   REGISTRY      where the images come from (default: ghcr.io/soudaysse-ia; a mirror, or a local registry in tests)
#   SKIP_SETUP=1  skip the system setup (packages, firewall, SSH): tests, or a server already prepared
set -euo pipefail

REF="${TWABIBU_REF:-main}"
RAW="https://raw.githubusercontent.com/Soudaysse-ia/twabibu/${REF}"
DIR="${TWABIBU_DIR:-/srv/twabibu}"
SCRIPTS=(backup.sh deploy.sh restore.sh rollback.sh server-setup.sh demo-quickstart.sh watch.sh errors.sh)

log() { printf '\n== %s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[ "$(id -u)" = 0 ] || fail "run as root"

# Copies one repository file to the server, from SOURCE_DIR or from GitHub.
fetch() {
  local from="$1" to="$2"
  if [ -n "${SOURCE_DIR:-}" ]; then cp "${SOURCE_DIR}/${from}" "$to"; else curl -fsSL --retry 3 "${RAW}/${from}" -o "$to"; fi
}

# The server's public IPv4: Hetzner metadata first, then the address used to reach the internet.
public_ipv4() {
  local ip
  ip="$(curl -fsS --max-time 2 http://169.254.169.254/hetzner/v1/metadata/public-ipv4 2>/dev/null || true)"
  if ! [[ "$ip" =~ ^[0-9]+(\.[0-9]+){3}$ ]]; then
    ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}')"
  fi
  [[ "$ip" =~ ^[0-9]+(\.[0-9]+){3}$ ]] || return 1
  # A private address means the server is behind NAT: sslip.io would point nowhere useful.
  [[ "$ip" =~ ^(10\.|127\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.) ]] && return 1
  echo "$ip"
}

# Sets KEY=value in .env, replacing the line from the template or adding it.
set_env() {
  local key="$1" value="$2"
  if grep -qE "^${key}=" "$DIR/.env"; then
    KEY="$key" VALUE="$value" awk 'BEGIN { k = ENVIRON["KEY"]; v = ENVIRON["VALUE"] } index($0, k "=") == 1 { print k "=" v; next } { print }' "$DIR/.env" > "$DIR/.env.tmp"
    mv "$DIR/.env.tmp" "$DIR/.env"
  else
    printf '%s=%s\n' "$key" "$value" >> "$DIR/.env"
  fi
}

if [ "${SKIP_SETUP:-}" != 1 ]; then
  log "System setup (packages, Docker, deploy user, firewall, backups)"
  fetch infra/scripts/server-setup.sh /tmp/twabibu-server-setup.sh
  bash /tmp/twabibu-server-setup.sh
fi
id deploy > /dev/null 2>&1 || fail "no deploy user: run without SKIP_SETUP"
install -d -m 750 -o deploy -g deploy "$DIR" "$DIR/scripts" "$DIR/certs" "$DIR/backups"

log "Application files (${SOURCE_DIR:-GitHub ${REF}})"
fetch infra/docker/docker-compose.prod.yml "$DIR/docker-compose.yml"
fetch infra/caddy/Caddyfile "$DIR/Caddyfile"
for s in "${SCRIPTS[@]}"; do fetch "infra/scripts/$s" "$DIR/scripts/$s"; done
chmod 750 "$DIR"/scripts/*.sh

if [ -f "$DIR/.env" ]; then
  log "Keeping the existing .env (secrets and address unchanged)"
else
  log "Configuration"
  if [ -n "${DEMO_DOMAIN:-}" ]; then
    domain="$DEMO_DOMAIN"
  else
    ip="$(public_ipv4)" || fail "no public IPv4 address found: set DEMO_DOMAIN to a name that points to this server"
    domain="${ip//./-}.sslip.io"
  fi
  [[ "$domain" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]] || fail "invalid domain: $domain"
  fetch infra/env/staging.env.example "$DIR/.env"
  set_env APP_ENV staging
  set_env APP_URL "https://${domain}"
  set_env ADMIN_URL "https://admin.${domain}"
  set_env SITE_DOMAIN "$domain"
  set_env ADMIN_DOMAIN "admin.${domain}"
  set_env ADMIN_ALLOWED_IPS "${ADMIN_IPS:-127.0.0.1/32}"
  set_env TLS_MODE acme
  set_env TAG staging
  [ -z "${REGISTRY:-}" ] || set_env REGISTRY "$REGISTRY"
  # Secrets are generated here and never leave the server. Keep a copy of ENCRYPTION_KEY if the demo matters.
  for key in POSTGRES_PASSWORD SESSION_SECRET ENCRYPTION_KEY; do set_env "$key" "$(openssl rand -hex 32)"; done
  set_env EMAIL_PROVIDER fake
  set_env SMS_PROVIDER fake
fi
chown -R deploy:deploy "$DIR"
chmod 600 "$DIR/.env"

log "Deployment (images, migrations, demo data, start)"
runuser -u deploy -- "$DIR/scripts/deploy.sh" staging

site="$(grep -E '^APP_URL=' "$DIR/.env" | cut -d= -f2-)"
admin="$(grep -E '^ADMIN_URL=' "$DIR/.env" | cut -d= -f2-)"
log "Waiting for the HTTPS certificate"
ready=0
for _ in $(seq 1 30); do
  if curl -fs --max-time 5 -o /dev/null "${site}/api/ready" 2> /dev/null; then ready=1; break; fi
  sleep 5
done

cat <<EOF

=================================================================
 Twabibu demo $([ "$ready" = 1 ] && echo "is online" || echo "is started (HTTPS not answering yet: retry in a few minutes)")
   Site:          ${site}
   Back-office:   ${admin}  (closed unless ADMIN_ALLOWED_IPS in ${DIR}/.env lists your address)
   Demo accounts: see ${site}/demo ; sign-in code: 000000
 Logs:            cd ${DIR} && docker compose logs -f
 Update later:    bash ${DIR}/scripts/demo-quickstart.sh  (keeps .env)
=================================================================
EOF
