#!/usr/bin/env bash
set -euo pipefail

HOST="${DEPLOY_HOST:-ubuntu@137.74.117.195}"
SSH_OPTS=(-o IdentitiesOnly=yes)
if [[ -n "${DEPLOY_KEY:-}" ]]; then SSH_OPTS+=(-i "$DEPLOY_KEY"); fi
SERVER_DIR="$(cd "$(dirname "$0")/.." && pwd)"

rsync -az --delete -e "ssh ${SSH_OPTS[*]}" \
    --exclude data --exclude test --exclude deploy --exclude node_modules \
    "$SERVER_DIR/" "$HOST:/tmp/kahocord-badges-release/"
scp "${SSH_OPTS[@]}" "$SERVER_DIR/deploy/kahocord-badges.service" "$SERVER_DIR/deploy/api.kaho.fr.conf" "$HOST:/tmp/"

ssh "${SSH_OPTS[@]}" "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
id kahocord >/dev/null 2>&1 || sudo useradd --system --home /var/lib/kahocord-badges --shell /usr/sbin/nologin kahocord
sudo mkdir -p /opt/kahocord-badges /var/lib/kahocord-badges
sudo rsync -a --delete /tmp/kahocord-badges-release/ /opt/kahocord-badges/
sudo chown -R root:root /opt/kahocord-badges
sudo chown -R kahocord:kahocord /var/lib/kahocord-badges
sudo chmod 750 /var/lib/kahocord-badges
if [[ ! -f /etc/kahocord-badges.env ]]; then
    printf 'KAHOCORD_HOST=127.0.0.1\nKAHOCORD_PORT=8792\nKAHOCORD_PUBLIC_URL=https://api.kaho.fr\nKAHOCORD_DATA_DIR=/var/lib/kahocord-badges\nKAHOCORD_CLIENT_SECRET=kahocord-client\nKAHOCORD_ALLOWED_ORIGINS=https://discord.com\n' | sudo tee /etc/kahocord-badges.env >/dev/null
    sudo chown root:kahocord /etc/kahocord-badges.env
    sudo chmod 640 /etc/kahocord-badges.env
fi
sudo install -m 644 /tmp/kahocord-badges.service /etc/systemd/system/kahocord-badges.service
if [[ ! -f /etc/apache2/sites-available/api.kaho.fr-le-ssl.conf ]]; then
    sudo install -m 644 /tmp/api.kaho.fr.conf /etc/apache2/sites-available/api.kaho.fr.conf
    sudo a2ensite api.kaho.fr.conf >/dev/null
fi
sudo systemctl daemon-reload
sudo systemctl enable --now kahocord-badges >/dev/null 2>&1
sudo systemctl restart kahocord-badges
sudo apache2ctl configtest
sudo systemctl reload apache2
rm -rf /tmp/kahocord-badges-release /tmp/kahocord-badges.service /tmp/api.kaho.fr.conf
sleep 1
curl -fsS http://127.0.0.1:8792/health
REMOTE
