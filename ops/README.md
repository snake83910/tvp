# Ops

## Sauvegardes

`backup.sh` produit deux archives horodatées par exécution :

| Fichier | Contenu |
|---|---|
| `tvp_<TS>.sql.gz` | dump PostgreSQL (`--clean --if-exists`) |
| `uploads_<TS>.tar.gz` | volume `/app/uploads` — Kbis des garages |

Le script vérifie les deux archives (intégrité gzip **et** marqueur de fin
du dump, qui seul détecte un `pg_dump` tronqué) *avant* de purger les
anciennes, envoie hors-site si c'est configuré, puis fait la rotation.
Toute erreur interrompt le script en sortie non nulle sans rien supprimer.

**Installation sur le VPS** :
```bash
chmod +x /var/www/tvp/tvp/ops/backup.sh /var/www/tvp/tvp/ops/restore.sh
crontab -e
# Ajouter (RCLONE_REMOTE : voir « Copie hors-site » ci-dessous) :
0 3 * * * RCLONE_REMOTE=tvp-backup:tvp /var/www/tvp/tvp/ops/backup.sh >> /var/log/tvp-backup.log 2>&1
```

**Test manuel** :
```bash
sudo /var/www/tvp/tvp/ops/backup.sh
ls -lh /var/backups/tvp/
```

### Copie hors-site

Sans elle, les sauvegardes vivent sur la machine qu'elles protègent : une
panne disque ou un VPS perdu emporte les données **et** leurs copies. Le
script la saute en le signalant tant que `RCLONE_REMOTE` est vide.

```bash
apt install rclone
rclone config          # créer un remote S3 / Ionos Object Storage / Backblaze…
```

Ces archives contiennent des données personnelles clients (noms, adresses,
emails, SIRET). Les déposer en clair chez un tiers n'est pas acceptable :
configurer le remote en **`crypt`** par-dessus le remote de stockage, ce
qui chiffre côté VPS avant l'envoi. C'est rclone qui s'en charge, le script
n'a pas à connaître de clé — et la clé de chiffrement doit être conservée
**ailleurs que sur le VPS**, sinon le chiffrement ne protège de rien.

La rétention hors-site se règle côté fournisseur (règles de cycle de vie du
bucket) ; `RETENTION_DAYS` ne concerne que les copies locales.

### Restauration

```bash
/var/www/tvp/tvp/ops/restore.sh /var/backups/tvp/tvp_20260614_030001.sql.gz
```

L'archive `uploads_` de même horodatage est restaurée automatiquement si
elle est à côté du dump (`RESTORE_UPLOADS=0` pour ne prendre que la base).
La base est restaurée en une seule transaction avec `ON_ERROR_STOP=1` :
en cas d'échec elle reste dans son état d'origine plutôt qu'à moitié
écrasée. Les fichiers uploadés, eux, sont **fusionnés** par-dessus
l'existant : un fichier absent de l'archive n'est pas supprimé.

### Répétition à blanc

Une sauvegarde jamais restaurée n'est pas une sauvegarde vérifiée. À faire
périodiquement sur une base jetable, sans toucher à la production :

```bash
docker compose exec -T postgres createdb -U tvp tvp_restore_test
DB_NAME=tvp_restore_test RESTORE_UPLOADS=0 ./ops/restore.sh <dump>
docker compose exec -T postgres psql -U tvp -d tvp_restore_test -c "select count(*) from users"
docker compose exec -T postgres dropdb -U tvp tvp_restore_test
```

### Hors périmètre

Le `.env` de production n'est pas sauvegardé : il contient les secrets
(JWT, Sogecommerce, SMTP) et n'a rien à faire dans le même dépôt que les
dumps. Il doit être conservé séparément — sans lui, une restauration
redonne les données mais pas une application qui démarre.

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
15 * * * * curl -sS -X POST -H "X-Cron-Token: <le_token>" https://tousvospneus.com/api/cron/appointments >/dev/null 2>&1
30 10 * * * curl -sS -X POST -H "X-Cron-Token: <le_token>" https://tousvospneus.com/api/cron/reviews >/dev/null 2>&1
```

Effets :

`/cron/dunning` — toutes les heures
- **Demande d'abord à la banque** ce qu'elle a encaissé, pour les commandes
  en attente depuis plus de 15 min. Un IPN perdu (nginx qui redémarre,
  coupure réseau) laisse une commande payée en `pending_payment` : cette
  passe la rattrape et envoie la confirmation au client.
- Relance les commandes `pending_payment` créées il y a plus d'1h
- Au bout de 7 jours sans paiement, la commande est annulée — **uniquement
  si la banque a confirmé n'avoir rien encaissé**. Sinon la commande reste
  en attente et remonte dans « paiements à vérifier » sur le tableau de
  bord admin. Ne jamais annuler dans le doute : le client est peut-être
  débité.

> **Prérequis Sogecommerce** : la vérification utilise l'API `Order/Get`
> (droit `WS_REST_GET`). Si elle n'est pas activée sur la boutique, chaque
> contrôle rend `unavailable` et **plus aucune commande n'est annulée
> automatiquement** — elles s'empilent dans l'écran « à vérifier ». Vérifier
> dans le Back Office → Paramétrage → Boutique → Clés d'API REST. Le
> comportement est volontairement conservateur, mais il suppose un tri
> manuel tant que ce droit manque.

`/cron/appointments` — toutes les heures
- Rappel la veille du montage (le no-show est le premier coût d'un planning en ligne)
- Alerte « pneus pas encore expédiés » quand le rendez-vous approche, avec un
  lien pour le décaler

`/cron/reviews` — une fois par jour
- Deux jours après une livraison en garage partenaire, demande un avis sur le
  garage. Une seule demande par commande ; rien si le client a déjà noté ce
  garage.
- Décalé à 10h30 : un email d'avis n'a aucune raison de partir la nuit.

## Remboursements

Depuis l'écran commande de l'admin, le site appelle lui-même
`Transaction/CancelOrRefund` (API REST V4). La banque choisit seule entre
les deux opérations, et c'est voulu :

- transaction **pas encore remise en banque** → annulation, le client
  n'est jamais débité ;
- transaction **déjà capturée** → remboursement, une transaction de type
  `CREDIT` est créée, créditée sous quelques jours ouvrés.

Garde-fous :

- **Rien n'est marqué remboursé sans réponse claire de la banque.** Un
  appel refusé ou expiré laisse la commande intacte, et l'admin peut
  réessayer. L'inverse laisserait un statut « remboursée » sans un
  centime rendu.
- **Un seul remboursement par commande** : la ligne est verrouillée
  (`SELECT … FOR UPDATE`) avant l'appel réseau, donc deux clics rapides
  ne produisent pas deux crédits.
- La transaction à rembourser est **relue chez la banque** à chaque
  fois, jamais reprise d'un payload stocké, et seul le débit accepté est
  retenu (ni un crédit déjà émis, ni une tentative refusée).
- La réponse bancaire (`uuid` du crédit, statut) est archivée sur le
  paiement et dans l'audit : c'est la seule preuve exploitable en cas de
  réclamation.

Si les clés REST manquent (`SOGECOMMERCE_SHOP_ID` /
`SOGECOMMERCE_API_PASSWORD`), l'écran bascule sur la **déclaration
manuelle** : l'admin rembourse au Back Office et saisit le montant. Ces
commandes portent `refund_mode = 'manual'` — enregistré sans preuve
bancaire, et l'interface le dit explicitement. Une case à cocher permet
aussi de forcer ce mode quand le remboursement a déjà été fait à la main.

## Monitoring uptime (UptimeRobot, gratuit)

1. Compte gratuit sur https://uptimerobot.com (50 monitors gratuits, check toutes les 5 min)
2. Ajouter un monitor type **HTTP(s)** :
   - URL : `https://tousvospneus.com/api/health`
   - Interval : 5 min
   - Alert contacts : ton email + (optionnel) webhook Slack/Discord
3. UptimeRobot interprète le code HTTP : `200 OK` → up, `503` → down (donc si DB ou Redis tombent, alerte automatique)
4. Ajouter un **second monitor** sur `https://tousvospneus.com/api/health/jobs`

`/health/jobs` répond 503 dès qu'une tâche planifiée n'a pas tourné depuis
plus de deux fois sa période. C'est le seul moyen de voir un crontab perdu
au redéploiement ou un `CRON_TOKEN` régénéré sans mise à jour de la ligne
cron : sans lui, les relances de paiement, les rappels de rendez-vous et
les demandes d'avis s'arrêtent tous les trois en silence.

Deux sondes séparées, volontairement : un job en retard ne veut pas dire
que le site est tombé. Les mélanger ferait crier « site indisponible »
pour une relance email en retard, et cette alerte-là finirait ignorée.
Nommer le monitor « Jobs planifiés » pour que l'alerte se lise seule.

L'état détaillé (compte rendu du dernier passage, message d'erreur) est
sur le tableau de bord admin — l'endpoint public ne rend délibérément
aucun compteur métier.

## Logs

Tous les logs API/web sont en JSON depuis `e6e85c4`. Pour parser :
```bash
docker compose logs api --tail=100 | jq 'select(.level=="ERROR")'
```

## Améliorations sécurité à venir

### CSP nonces (remplacer unsafe-inline)

La CSP actuelle utilise `'unsafe-inline'` pour styles/scripts (Tailwind/Next inlinent
les styles critiques). Pour passer à des nonces par-request :

1. Middleware Next.js qui génère un nonce, le passe en header CSP et l'injecte dans
   le contexte React (via `headers()` puis lecture côté layout).
2. Tous les `<script>`/`<style>` inline doivent recevoir l'attribut `nonce={nonce}`.
3. Remplacer `'unsafe-inline'` par `'nonce-{nonce}'` dans next.config.js (middleware).

Effort : 1-2j. Bénéfice : protection XSS supplémentaire. À planifier si une faille
XSS est jamais découverte.

### Chiffrement at-rest des données sensibles (pgcrypto)

Pour chiffrer SIRET, téléphone, adresses au repos :

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Migration : ajouter colonnes _enc et migrer
ALTER TABLE pro_profiles ADD COLUMN siret_enc bytea;
UPDATE pro_profiles SET siret_enc = pgp_sym_encrypt(siret, current_setting('app.encrypt_key'));
```

Côté code : utiliser `pgp_sym_encrypt`/`pgp_sym_decrypt` via `func.pgp_sym_*` dans
SQLAlchemy. Clé maître à passer via `SET app.encrypt_key = 'xxx'` au démarrage de
la session DB.

Effort : 2-3j. Bénéfice : compliance + tranquillité en cas de fuite de backup
PostgreSQL (les dumps deviennent illisibles sans la clé).

### Web Push Notifications navigateur

Pour alerter l'admin en temps réel d'une nouvelle commande :

1. Générer une paire de clés VAPID : `npx web-push generate-vapid-keys`
2. Service Worker côté frontend qui s'abonne via `pushManager.subscribe()`
3. Endpoint backend `POST /admin/notifications/subscribe` qui stocke l'endpoint
4. À chaque création de commande payée, le backend envoie via `pywebpush`

Effort : 1j. Bénéfice : pas besoin de garder l'onglet ouvert.

## Restauration en cas d'incident

1. Identifier le dernier backup valide : `ls -lt /var/backups/tvp/`
2. Mettre le site en maintenance (recommandé : Apache 503 temporaire)
3. `./restore.sh /var/backups/tvp/<backup>.sql.gz`
4. Redémarrer l'app : `docker compose restart api web`
5. Vérifier `/api/health`
