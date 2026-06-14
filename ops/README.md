# Ops

## Backup automatique PostgreSQL

`backup.sh` dump la base via `pg_dump`, compresse en gzip, rotation 30j.

**Installation sur le VPS** :
```bash
chmod +x /var/www/tvp/tvp/ops/backup.sh
crontab -e
# Ajouter :
0 3 * * * /var/www/tvp/tvp/ops/backup.sh >> /var/log/tvp-backup.log 2>&1
```

**Test manuel** :
```bash
sudo /var/www/tvp/tvp/ops/backup.sh
ls -lh /var/backups/tvp/
```

**Restore** :
```bash
/var/www/tvp/tvp/ops/restore.sh /var/backups/tvp/tvp_20260614_030001.sql.gz
```

## Sentry (error tracking)

### Backend (FastAPI)

1. Compte gratuit sur https://sentry.io (5K erreurs/mois)
2. Créer un projet "Python / FastAPI"
3. Copier le DSN puis sur le VPS :
   ```bash
   echo 'SENTRY_DSN=https://xxx@oxxx.ingest.sentry.io/xxx' >> /var/www/tvp/tvp/.env
   docker compose restart api
   ```

### Frontend (Next.js)

```bash
cd /var/www/tvp/tvp/web
npx @sentry/wizard@latest -i nextjs
# Suivre le wizard interactif (choisir le projet Sentry)
```

## Jobs cron

Le backend expose `/cron/*` pour les tâches planifiées (relances paiement, etc.).
Sécurisés par header `X-Cron-Token` (variable `CRON_TOKEN` dans `.env`).

**Générer un token** :
```bash
openssl rand -hex 32
# Coller dans /var/www/tvp/tvp/.env : CRON_TOKEN=<le_token>
docker compose restart api
```

**Installer le cron** :
```bash
crontab -e
# Ajouter :
0 * * * * curl -sS -X POST -H "X-Cron-Token: <le_token>" https://tousvospneus.com/api/cron/dunning >/dev/null 2>&1
```

Effets :
- Toutes les heures, relance les commandes `pending_payment` créées il y a plus d'1h
- Au bout de 7 jours sans paiement, la commande est annulée automatiquement

## Monitoring uptime (UptimeRobot, gratuit)

1. Compte gratuit sur https://uptimerobot.com (50 monitors gratuits, check toutes les 5 min)
2. Ajouter un monitor type **HTTP(s)** :
   - URL : `https://tousvospneus.com/api/health`
   - Interval : 5 min
   - Alert contacts : ton email + (optionnel) webhook Slack/Discord
3. UptimeRobot interprète le code HTTP : `200 OK` → up, `503` → down (donc si DB ou Redis tombent, alerte automatique)

## Logs

Tous les logs API/web sont en JSON depuis `e6e85c4`. Pour parser :
```bash
docker compose logs api --tail=100 | jq 'select(.level=="ERROR")'
```

## Restauration en cas d'incident

1. Identifier le dernier backup valide : `ls -lt /var/backups/tvp/`
2. Mettre le site en maintenance (recommandé : Apache 503 temporaire)
3. `./restore.sh /var/backups/tvp/<backup>.sql.gz`
4. Redémarrer l'app : `docker compose restart api web`
5. Vérifier `/api/health`
