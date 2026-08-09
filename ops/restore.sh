#!/usr/bin/env bash
# Restauration depuis une sauvegarde produite par backup.sh.
#
# Usage :
#   ./restore.sh /var/backups/tvp/tvp_20260614_030001.sql.gz
#
# L'archive des fichiers uploadés portant le même horodatage est
# restaurée automatiquement si elle est présente à côté du dump. Pour ne
# restaurer que la base : RESTORE_UPLOADS=0 ./restore.sh <dump>
#
# Répétition à blanc — à faire périodiquement, une sauvegarde jamais
# restaurée n'est pas une sauvegarde vérifiée. Sur une base jetable,
# sans toucher à la production :
#   docker compose exec -T postgres createdb -U tvp tvp_restore_test
#   DB_NAME=tvp_restore_test RESTORE_UPLOADS=0 ./restore.sh <dump>
#   docker compose exec -T postgres dropdb -U tvp tvp_restore_test

set -euo pipefail

if [ $# -ne 1 ]; then
    echo "Usage: $0 <backup_file.sql.gz>" >&2
    exit 1
fi

BACKUP_FILE="$1"
COMPOSE_DIR=${COMPOSE_DIR:-/var/www/tvp/tvp}
RESTORE_UPLOADS=${RESTORE_UPLOADS:-1}
DB_NAME=${DB_NAME:-tvp}

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }
fail() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERREUR : $*" >&2; exit 1; }

[ -f "$BACKUP_FILE" ] || fail "fichier introuvable : $BACKUP_FILE"

# Archive uploads correspondante : même horodatage, même répertoire.
UPLOADS_FILE=""
if [ "$RESTORE_UPLOADS" = "1" ]; then
    CANDIDATE=$(echo "$BACKUP_FILE" | sed 's/tvp_\(.*\)\.sql\.gz$/uploads_\1.tar.gz/')
    [ -f "$CANDIDATE" ] && UPLOADS_FILE="$CANDIDATE"
fi

# ── Vérifications AVANT de toucher à quoi que ce soit ─────────────────
# Découvrir que l'archive est corrompue après avoir vidé la base laisse
# sans base ET sans sauvegarde exploitable.
log "Vérification des archives…"
gunzip -t "$BACKUP_FILE" 2>/dev/null || fail "dump corrompu : $BACKUP_FILE"

DUMP_TAIL=$(gunzip -c "$BACKUP_FILE" | tail -20)
case "$DUMP_TAIL" in
    *"PostgreSQL database dump complete"*) ;;
    *) fail "dump incomplet (marqueur de fin absent) : $BACKUP_FILE" ;;
esac

# Les dumps produits avant l'ajout de --clean n'embarquent pas les DROP :
# les rejouer sur une base peuplée empile les données au lieu de les
# remplacer, et la restauration paraît réussir sur un état incohérent.
#
# On compte sur le flux entier, sans « head » ni « grep -q ». Les deux
# sortent avant la fin de l'entrée, ce qui envoie un SIGPIPE à gunzip en
# amont ; avec pipefail le pipeline est alors en échec et le dump — sain —
# est déclaré invalide. grep -c lit toute son entrée. Le « || true » est
# nécessaire parce que grep -c sort en 1 quand le compte est nul, ce que
# set -e prendrait pour une erreur.
DROP_COUNT=$(gunzip -c "$BACKUP_FILE" | grep -c "^DROP " || true)
if [ "$DROP_COUNT" -eq 0 ]; then
    fail "ce dump ne contient pas de DROP (antérieur à --clean --if-exists).
       Le restaurer sur une base peuplée produirait un état incohérent.
       Repartir d'une base vide, ou utiliser une sauvegarde plus récente."
fi

if [ -n "$UPLOADS_FILE" ]; then
    gunzip -t "$UPLOADS_FILE" 2>/dev/null || fail "archive uploads corrompue : $UPLOADS_FILE"
    log "Archive uploads détectée : $UPLOADS_FILE"
else
    log "Aucune archive uploads à restaurer."
fi

# ── Confirmation ──────────────────────────────────────────────────────
echo
echo "ATTENTION : la base '$DB_NAME' va être ÉCRASÉE par $BACKUP_FILE"
[ -n "$UPLOADS_FILE" ] && echo "            les fichiers uploadés seront écrasés par $UPLOADS_FILE"
echo
read -r -p "Confirmer (yes/no) : " confirm
if [ "$confirm" != "yes" ]; then
    echo "Annulé."
    exit 0
fi

cd "$COMPOSE_DIR"

# ── Base ──────────────────────────────────────────────────────────────
# ON_ERROR_STOP=1 : sans lui, psql poursuit après une erreur et le script
# annonce « Restore terminé » sur une base à moitié restaurée.
# --single-transaction : le DDL étant transactionnel sous PostgreSQL,
# un échec en cours laisse la base intacte plutôt qu'à moitié écrasée.
log "Restauration de la base…"
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres \
    psql -U tvp -d "$DB_NAME" -v ON_ERROR_STOP=1 --single-transaction >/dev/null

log "Base restaurée."

# ── Fichiers uploadés ─────────────────────────────────────────────────
if [ -n "$UPLOADS_FILE" ]; then
    log "Restauration des fichiers uploadés…"
    # tar est encapsulé dans sh -c, comme dans backup.sh : passé en
    # argument nu, « -C /app » est réécrit en chemin Windows par MSYS
    # quand le script tourne depuis Git Bash (tar cherche alors
    # « C:/Program Files/Git/app »). Entre guillemets simples, la chaîne
    # traverse intacte, et le comportement est le même sur le VPS.
    #
    # Sémantique : les fichiers de l'archive écrasent ceux en place, mais
    # ceux absents de l'archive ne sont PAS supprimés. C'est une fusion,
    # pas un remplacement — contrairement à la base, où --clean rétablit
    # exactement l'état sauvegardé.
    gunzip -c "$UPLOADS_FILE" | docker compose exec -T api \
        sh -c 'tar xf - -C /app --overwrite'
    log "Fichiers uploadés restaurés (fusion sur l'existant)."
fi

log "Restauration terminée. Vérifier /api/health puis une commande réelle."
