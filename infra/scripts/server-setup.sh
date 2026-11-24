#!/usr/bin/env bash
# One-time setup of a fresh Hetzner Cloud server (Ubuntu 24.04), as root:
#   curl -fsSL https://raw.githubusercontent.com/Soudaysse-ia/twabibu/main/infra/scripts/server-setup.sh -o setup.sh
#   less setup.sh   # read it first
#   bash setup.sh
# Then follow docs/03-architecture/runbooks/mise-en-production-hetzner.md.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }

echo "== System updates and automatic security updates"
# On a brand-new server the provider's first automatic update may hold the package lock: wait for it (10 min max).
apt-get -o DPkg::Lock::Timeout=600 update
DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=600 -o Dpkg::Options::=--force-confold -y upgrade
DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=600 -y install ca-certificates curl ufw fail2ban unattended-upgrades age rclone
dpkg-reconfigure -f noninteractive unattended-upgrades
timedatectl set-timezone UTC

echo "== Docker (official repository)"
if ! command -v docker > /dev/null; then
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sh /tmp/get-docker.sh
fi
systemctl enable --now docker

echo "== deploy user (used by GitHub Actions, no password, SSH key only)"
id deploy > /dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

echo "== SSH: keys only"
# Only once root has a key: a server created with a password would otherwise lock its owner out (the provider's web
# console still works, but nobody expects that).
if [ -s /root/.ssh/authorized_keys ]; then
  sed -i -E 's/^#?PasswordAuthentication .*/PasswordAuthentication no/; s/^#?PermitRootLogin .*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
  systemctl reload ssh || systemctl reload sshd
else
  echo "   No SSH key for root: password login left on. Add your key to /root/.ssh/authorized_keys, then run this again."
fi

echo "== Firewall: SSH, HTTP, HTTPS only (Postgres and Redis stay inside Docker)"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "== Application folder"
install -d -m 750 -o deploy -g deploy /srv/twabibu /srv/twabibu/scripts /srv/twabibu/certs /srv/twabibu/backups

echo "== Scheduled tasks: daily backup 02:30 UTC, restore test on the 1st of each month, watch every 5 minutes"
cat > /etc/cron.d/twabibu <<'CRON'
30 2 * * * deploy /srv/twabibu/scripts/backup.sh >> /srv/twabibu/backups/backup.log 2>&1
0 4 1 * * deploy f=$(ls -1t /srv/twabibu/backups/twabibu-*.dump | head -1) && /srv/twabibu/scripts/restore.sh --test "$f" >> /srv/twabibu/backups/restore-test.log 2>&1
*/5 * * * * deploy [ -x /srv/twabibu/scripts/watch.sh ] && /srv/twabibu/scripts/watch.sh >> /srv/twabibu/backups/watch.log 2>&1
CRON

echo
echo "Done. Next:"
echo "  1. Add the GitHub Actions public key to /home/deploy/.ssh/authorized_keys"
echo "  2. Create /srv/twabibu/.env from infra/env/<environment>.env.example (chmod 600, owner deploy)"
echo "  3. Run the first deployment from GitHub (Actions > Deploy)"
