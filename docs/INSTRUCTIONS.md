# Étape 2/2 : Emails transactionnels — installation

Cette archive contient le module Mailer complet (envoi SMTP IONOS),
les 5 templates HTML, et les instructions pour brancher sur les
événements de ton application.

---

## Contenu de l'archive

```
api/app/modules/mailer/
  __init__.py            ← factory (selon MAILER_PROVIDER)
  base.py                ← interface abstraite Mailer
  providers.py           ← SMTPMailer + ConsoleMailer
  service.py             ← API métier (send_welcome, send_order_confirmation, …)
  templates/
    _layout.html         ← layout commun (bandeau, pied)
    welcome.html
    order_confirmation.html
    order_shipped.html
    order_delivered.html
    order_cancelled.html

docs/
  CONFIG_DNS_IONOS.md    ← guide SPF + DKIM + DMARC (à faire chez IONOS)
  INSTRUCTIONS.md        ← ce fichier
  ENV_TEMPLATE.txt       ← variables à ajouter dans ton .env
```

---

## Marche à suivre, dans l'ordre

### 1. Décompresse l'archive

À la racine du projet `tvp\`. Le dossier `api/app/modules/mailer/`
se crée avec tous les fichiers dedans. Aucun fichier existant n'est
écrasé : c'est uniquement de l'ajout.

### 2. Ajoute `jinja2` aux dépendances

Ouvre `api/requirements.txt` et ajoute la ligne :

```
jinja2>=3.1
```

Si jinja2 est déjà dans requirements (FastAPI l'inclut parfois en
transitif), pas besoin. Mais l'ajouter explicitement est plus sûr.

### 3. Étends `app/core/config.py`

Cherche ta classe `Settings(BaseSettings)`. Ajoute ces champs dedans
(n'importe où dans la classe, je conseille à la fin) :

```python
    # Email transactionnel
    mailer_provider: str = "console"  # console | smtp
    smtp_host: str = "smtp.ionos.fr"
    smtp_port: int = 465
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_sender: str = ""             # peut différer de username
    smtp_use_ssl: bool = True         # 465 = SSL, 587 = STARTTLS

    # URL publique du site (utilisée dans les liens des emails)
    public_site_url: str = "http://localhost:3000"
```

### 4. Configure ton `.env`

Ouvre `api/.env` (ou `.env` à la racine, là où tu mets déjà
`DATABASE_URL`, `JWT_SECRET`, etc.) et ajoute :

```
# Mode développement : log les emails dans Docker au lieu d'envoyer
MAILER_PROVIDER=console

# Pour passer en envoi réel via IONOS :
# MAILER_PROVIDER=smtp
# SMTP_HOST=smtp.ionos.fr
# SMTP_PORT=465
# SMTP_USERNAME=serviceclient@tousvospneus.com
# SMTP_PASSWORD=ton-mot-de-passe-ionos
# SMTP_SENDER=serviceclient@tousvospneus.com
# SMTP_USE_SSL=true

PUBLIC_SITE_URL=http://localhost:3000
```

**Recommandation** : commence en mode `console`. Les emails seront
visibles dans `docker compose logs api`, tu peux vérifier que tout
le contenu est correct avant d'envoyer pour de vrai.

### 5. Branche l'email de bienvenue sur l'inscription

Ouvre `api/app/modules/auth/router.py` (ou le fichier qui contient ta
route `/auth/register`). Cherche la fonction `register` ou similaire.
**Tout en bas de la fonction**, juste avant le `return` final, ajoute :

```python
    from app.modules.mailer.service import send_welcome
    send_welcome(user)
```

(`user` doit être l'objet User qui vient d'être créé. Si la variable
s'appelle autrement chez toi, adapte.)

### 6. Branche les emails de commande

#### a) Confirmation après paiement validé

Ouvre `api/app/modules/orders/payment_router.py`. Dans la fonction
`simulate_payment` (et aussi dans `payment_ipn` pour quand tu
passeras en Sogecommerce réel), **après** le commit qui passe la
commande à 'paid', ajoute :

```python
    # Email de confirmation au client
    from app.modules.mailer.service import send_order_confirmation
    from sqlalchemy.orm import selectinload
    # Recharger l'order AVEC ses items + le user pour le mail
    order_full = await db.scalar(
        select(Order)
        .where(Order.id == order.id)
        .options(selectinload(Order.items))
    )
    if order_full:
        send_order_confirmation(order_full, user)
```

#### b) Email d'expédition / livraison / annulation

Ces emails s'envoient quand TOI tu changes le statut d'une commande.
Tu n'as pas encore d'interface admin pour ça — donc pour l'instant on
ne branche rien automatiquement. Le code est prêt, on l'appellera dès
qu'on aura un écran admin (étape ultérieure).

### 7. Redémarre l'API

```powershell
cd C:\Users\remy1\Projets\tvp
docker compose restart api
```

### 8. Teste en mode console

1. Crée un nouveau compte (inscription).
2. Vérifie `docker compose logs api --tail 50`.
3. Tu dois voir un bloc :
   ```
   ============================================================
   EMAIL (mode console) -> ton@email.com
   Sujet : Bienvenue chez Tous Vos Pneus
   ------------------------------------------------------------
   HTML (extrait) : <!DOCTYPE html...
   ============================================================
   ```
4. Passe une commande et simule le paiement.
5. Vérifie qu'un second email "Confirmation de votre commande TVP-..."
   apparaît dans les logs.

### 9. Quand tout est OK en console, passe en SMTP réel

Modifie ton `.env` :

```
MAILER_PROVIDER=smtp
SMTP_USERNAME=serviceclient@tousvospneus.com
SMTP_PASSWORD=ton-mot-de-passe-ionos
SMTP_SENDER=serviceclient@tousvospneus.com
```

Puis :

```powershell
docker compose restart api
```

Refais le test inscription + commande. Tu dois recevoir des vrais
emails dans ta boîte serviceclient (ou l'adresse du compte test).

**IMPORTANT** : avant de tester en SMTP réel, lis
`docs/CONFIG_DNS_IONOS.md` et configure SPF / DKIM / DMARC chez IONOS.
Sans ça, tes emails risquent fortement de finir en spam chez tes
clients (surtout Gmail qui est très strict depuis 2024).
