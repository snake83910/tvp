#!/usr/bin/env bash
# Restore PostgreSQL depuis un backup .sql.gz
# Usage : ./restore.sh /var/backups/tvp/tvp_20260614_030001.sql.gz

set -euo pipefail

if [ $# -ne 1 ]; then
    echo "Usage: $0 <backup_file.sql.gz>" >&2
    exit 1
fi

BACKUP_FILE="$1"
COMPOSE_DIR=${COMPOSE_DIR:-/var/www/tvp/tvp}

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Fichier introuvable : $BACKUP_FILE" >&2
    exit 1
fi

echo "ATTENTION : la base 'tvp' sera ÉCRASÉE par le contenu de $BACKUP_FILE"
read -p "Confirmer (yes/no) : " confirm
if [ "$confirm" != "yes" ]; then
    echo "Annulé."
    exit 0
fi

cd "$COMPOSE_DIR"
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U tvp -d tvp

echo "Restore terminé."
