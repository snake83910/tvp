#!/usr/bin/env bash
# Sauvegarde quotidienne : base PostgreSQL + volume des fichiers uploadés,
# vérification d'intégrité, puis copie hors-site optionnelle.
#
# À installer sur le VPS via cron :
#   crontab -e
#   0 3 * * * /var/www/tvp/tvp/ops/backup.sh >> /var/log/tvp-backup.log 2>&1
#
# Réglages par variables d'environnement (valeurs par défaut ci-dessous) :
#   BACKUP_DIR      répertoire local des sauvegardes
#   RETENTION_DAYS  rétention locale
#   COMPOSE_DIR     racine du dépôt sur le VPS
#   RCLONE_REMOTE   destination hors-site, ex. "tvp-backup:tvp". Vide =
#                   copie hors-site désactivée (même convention que
#                   CRON_TOKEN : non configuré = inactif, pas d'erreur).

set -euo pipefail

BACKUP_DIR=${BACKUP_DIR:-/var/backups/tvp}
RETENTION_DAYS=${RETENTION_DAYS:-30}
COMPOSE_DIR=${COMPOSE_DIR:-/var/www/tvp/tvp}
RCLONE_REMOTE=${RCLONE_REMOTE:-}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }
fail() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERREUR : $*" >&2; exit 1; }

# Un cron toutes les 24 h et une sauvegarde qui dépasse 24 h finissent par
# se chevaucher : deux pg_dump concurrents, et une rotation qui s'exécute
# pendant l'écriture de l'autre. flock sérialise sans attendre.
# flock fait partie d'util-linux, présent sur le VPS ; il manque sur
# certains environnements (Git Bash sous Windows). On distingue les deux
# cas : sans ce garde-fou, un flock absent serait signalé comme « une
# sauvegarde est déjà en cours » et enverrait sur une fausse piste.
LOCK_FILE="/tmp/tvp-backup.lock"
if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK_FILE"
    flock -n 9 || fail "une sauvegarde est déjà en cours (verrou $LOCK_FILE)"
else
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] flock indisponible : exécutions concurrentes non protégées" >&2
fi

mkdir -p "$BACKUP_DIR"
cd "$COMPOSE_DIR"

DUMP_FILE="$BACKUP_DIR/tvp_$TIMESTAMP.sql.gz"
UPLOADS_FILE="$BACKUP_DIR/uploads_$TIMESTAMP.tar.gz"

# ── 1. Base PostgreSQL ────────────────────────────────────────────────
# --clean --if-exists : le dump porte les DROP de ses propres objets. Sans
# ça, le restaurer sur une base non vide empile les données au lieu de les
# remplacer — la restauration semble réussir et laisse un état incohérent.
log "Dump PostgreSQL…"
docker compose exec -T postgres \
    pg_dump -U tvp -d tvp --clean --if-exists \
    | gzip > "$DUMP_FILE"

# ── 2. Fichiers uploadés (Kbis des garages) ───────────────────────────
# Volume persistant en production, absent tant qu'aucun garage n'a déposé
# de document : le mkdir garde le tar valide dans ce cas.
log "Archive des fichiers uploadés…"
docker compose exec -T api \
    sh -c 'mkdir -p /app/uploads && tar czf - -C /app uploads' \
    > "$UPLOADS_FILE"

# ── 3. Vérifications — AVANT la rotation ──────────────────────────────
# L'ordre compte : vérifier après avoir purgé les anciennes sauvegardes
# revient à supprimer les copies saines au moment précis où la nouvelle
# est corrompue.
log "Vérification des archives…"

gunzip -t "$DUMP_FILE" 2>/dev/null || fail "dump SQL corrompu : $DUMP_FILE"
gunzip -t "$UPLOADS_FILE" 2>/dev/null || fail "archive uploads corrompue : $UPLOADS_FILE"

# gunzip -t ne prouve que l'intégrité du conteneur gzip, pas que le dump
# est complet : un pg_dump tué en cours (disque plein, conteneur arrêté)
# produit un gzip parfaitement valide et un SQL tronqué. pg_dump termine
# toujours par ce marqueur.
#
# Deux précautions dans ces trois lignes :
#   - on garde 20 lignes de marge, pas 5. Sur PostgreSQL 16.14 le marqueur
#     est suivi d'un « \unrestrict », donc en 5e position depuis la fin :
#     pile à la limite. Si un futur correctif allonge ce pied de page, un
#     contrôle trop serré cesserait de trouver le marqueur et validerait
#     alors les dumps tronqués — il échouerait dans le mauvais sens.
#   - pas de « | grep -q » : grep ferme le tube dès qu'il trouve, tail
#     prend un SIGPIPE, et pipefail fait échouer le pipeline sur un dump
#     pourtant sain. Le résultat dépend de la taille du tampon, donc la
#     panne serait intermittente. La substitution lit tout.
DUMP_TAIL=$(gunzip -c "$DUMP_FILE" | tail -20)
case "$DUMP_TAIL" in
    *"PostgreSQL database dump complete"*) ;;
    *) fail "dump SQL incomplet (marqueur de fin absent) : $DUMP_FILE" ;;
esac

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
UPLOADS_SIZE=$(du -h "$UPLOADS_FILE" | cut -f1)
log "OK — base $DUMP_SIZE, uploads $UPLOADS_SIZE"

# ── 4. Copie hors-site ────────────────────────────────────────────────
# Sans cette étape, les sauvegardes vivent sur la machine qu'elles sont
# censées protéger : une panne disque ou un VPS perdu emporte les données
# ET leurs copies.
if [ -n "$RCLONE_REMOTE" ]; then
    if ! command -v rclone >/dev/null 2>&1; then
        fail "RCLONE_REMOTE est configuré mais rclone n'est pas installé"
    fi
    log "Envoi hors-site vers $RCLONE_REMOTE…"
    rclone copy "$DUMP_FILE"    "$RCLONE_REMOTE" --no-traverse
    rclone copy "$UPLOADS_FILE" "$RCLONE_REMOTE" --no-traverse
    log "Copie hors-site terminée"
else
    log "ATTENTION : RCLONE_REMOTE non configuré, aucune copie hors-site."
    log "            Les sauvegardes ne survivent pas à la perte du VPS."
fi

# ── 5. Rotation locale ────────────────────────────────────────────────
# Uniquement maintenant : les archives du jour sont vérifiées et copiées.
log "Rotation locale (> $RETENTION_DAYS jours)…"
find "$BACKUP_DIR" -name "tvp_*.sql.gz"     -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +"$RETENTION_DAYS" -delete

log "Sauvegarde terminée."
