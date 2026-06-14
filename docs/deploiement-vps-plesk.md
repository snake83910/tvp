# Déploiement VPS Ionos + Plesk

## Architecture cible

```
Internet
   │
   ▼
Plesk Nginx (SSL Let's Encrypt)
   ├── tousvospneus.com ──────────► localhost:3000  (Next.js)
   └── api.tousvospneus.com ──────► localhost:8000  (FastAPI)
                                          │
                                    Docker réseau interne
                                    ├── postgres:5432
                                    └── redis:6379
```

---

## 1. Préparer le VPS

Se connecter en SSH :
```bash
ssh root@<IP_VPS>
```

Installer Docker :
```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
```

Vérifier :
```bash
docker --version
docker compose version
```

---

## 2. Déployer le code

```bash
mkdir -p /var/www/tvp
cd /var/www/tvp
git clone https://github.com/<votre-repo>/tvp.git .
```

Ou via rsync depuis votre machine locale :
```bash
rsync -avz --exclude '.git' --exclude 'node_modules' --exclude '__pycache__' \
  ./ root@<IP_VPS>:/var/www/tvp/
```

---

## 3. Créer le .env de production

```bash
cd /var/www/tvp
cp .env.example .env
nano .env
```

Valeurs à changer **obligatoirement** :

```env
# === Base de données ===
POSTGRES_PASSWORD=<mot_de_passe_fort>
DATABASE_URL=postgresql+asyncpg://tvp:<mot_de_passe_fort>@postgres:5432/tvp

# === Sécurité ===
JWT_SECRET=<générer avec : openssl rand -hex 32>

# === Application ===
ENVIRONMENT=production
API_BASE_URL=https://api.tousvospneus.com
PUBLIC_API_URL=https://api.tousvospneus.com
PUBLIC_SITE_URL=https://tousvospneus.com

# === CORS ===
CORS_ORIGINS=https://tousvospneus.com

# === Paiement ===
PAYMENT_PROVIDER=sogecommerce
SOGECOMMERCE_IPN_URL=https://api.tousvospneus.com/payment/ipn
SOGECOMMERCE_PUBLIC_KEY=62343537:publickey_XXXXXXXXXXXXXXXX  # clé de PRODUCTION
SOGECOMMERCE_API_PASSWORD=<mot_de_passe_api_production>
SOGECOMMERCE_HMAC_KEY=<cle_hmac_production>

# === Email ===
MAILER_PROVIDER=smtp
SMTP_HOST=smtp.ionos.fr
SMTP_PORT=465
SMTP_USERNAME=serviceclient@tousvospneus.com
SMTP_PASSWORD=<mot_de_passe_ionos>
SMTP_SENDER=serviceclient@tousvospneus.com
SMTP_USE_SSL=true
```

---

## 4. Lancer les conteneurs

```bash
cd /var/www/tvp
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Vérifier que tout tourne :
```bash
docker compose ps
docker compose logs api --tail 20
```

Appliquer les migrations :
```bash
docker compose exec api alembic upgrade head
```

---

## 5. Configurer Plesk

### 5a. Créer les deux domaines

Dans Plesk → **Ajouter un domaine** :
- `tousvospneus.com` (domaine principal)
- `api.tousvospneus.com` (sous-domaine)

### 5b. Activer SSL (Let's Encrypt)

Pour chaque domaine → **SSL/TLS** → **Let's Encrypt** → cocher "Sécuriser les mails aussi" → **Installer**.

### 5c. Configurer le reverse proxy — domaine principal

`tousvospneus.com` → **Apache & Nginx** → décocher "Proxied by Apache" →  
dans **Directives Nginx supplémentaires** :

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
```

### 5d. Configurer le reverse proxy — API

`api.tousvospneus.com` → **Apache & Nginx** → même case décochée →  
dans **Directives Nginx supplémentaires** :

```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    client_max_body_size 10m;
}
```

---

## 6. Vérifier le déploiement

```bash
# API accessible
curl https://api.tousvospneus.com/health

# Front accessible
curl -I https://tousvospneus.com

# IPN accessible (Sogecommerce doit pouvoir joindre cette URL)
curl -X POST https://api.tousvospneus.com/payment/ipn
```

---

## 7. Mise à jour du site (workflow)

Depuis votre machine locale :
```bash
# 1. Pousser les changements sur git
git push

# 2. Sur le VPS
ssh root@<IP_VPS>
cd /var/www/tvp
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Si migrations
docker compose exec api alembic upgrade head
```

---

## Notes

- **Postgres et Redis** ne sont pas exposés publiquement en prod (docker-compose.prod.yml supprime les ports).
- **Les clés Sogecommerce** : en prod utiliser les clés de production (sans `testpassword_`). Le Back Office a une section "Clés de production" séparée.
- **Logs** : `docker compose logs -f api` / `docker compose logs -f web`
- **Redémarrage automatique** : les services ont `restart: unless-stopped` → redémarrent après un reboot du VPS.
