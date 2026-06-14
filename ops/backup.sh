#!/usr/bin/env bash
# Backup PostgreSQL quotidien avec rotation 30 jours.
# À installer sur le VPS via cron :
#   crontab -e
#   0 3 * * * /var/www/tvp/tvp/ops/backup.sh >> /var/log/tvp-backup.log 2>&1

set -euo pipefail

BACKUP_DIR=${BACKUP_DIR:-/var/backups/tvp}
RETENTION_DAYS=${RETENTION_DAYS:-30}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
COMPOSE_DIR=${COMPOSE_DIR:-/var/www/tvp/tvp}

mkdir -p "$BACKUP_DIR"

DUMP_FILE="$BACKUP_DIR/tvp_$TIMESTAMP.sql.gz"

cd "$COMPOSE_DIR"
docker compose exec -T postgres pg_dump -U tvp -d tvp | gzip > "$DUMP_FILE"

echo "[$(date)] Backup créé : $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"

# Rotation : supprimer les backups > RETENTION_DAYS
find "$BACKUP_DIR" -name "tvp_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
echo "[$(date)] Rotation : backups > $RETENTION_DAYS jours supprimés"

# Vérification que le dump n'est pas vide / corrompu
if ! gunzip -t "$DUMP_FILE" 2>/dev/null; then
    echo "[$(date)] ERREUR : dump corrompu !" >&2
    exit 1
fi
