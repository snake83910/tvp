# Activer Sogecommerce en mode TEST

L'intégration est codée (mode page redirigée) et testée. Pour la
brancher sur ton compte Sogecommerce en mode test :

## 1. Récupérer tes clés de TEST

Back Office Sogecommerce → Paramétrage → **Clés d'API REST**.
Tu y vois plusieurs clés. Pour le mode test, il te faut :

- **Identifiant boutique** (Shop ID) — suite de chiffres
- **Mot de passe API de TEST** — commence par `testpassword_`
- **Clé HMAC-SHA256 de TEST** — pour vérifier les IPN
- (La clé publique de test sert côté front, on la branchera avec le
  frontend Next.js)

> Ne colle JAMAIS ces clés dans une conversation. Elles vont
> uniquement dans ton `.env` local, jamais dans Git.

## 2. Configurer le .env

```
PAYMENT_PROVIDER=sogecommerce
SOGECOMMERCE_SHOP_ID=<ton shop id>
SOGECOMMERCE_API_PASSWORD=testpassword_xxxxx
SOGECOMMERCE_HMAC_KEY=<ta clé HMAC de test>
SOGECOMMERCE_IPN_URL=<url publique joignable, voir étape 3>
```

## 3. L'URL IPN : le point important en local

Sogecommerce doit pouvoir **joindre ton serveur depuis l'extérieur**
pour notifier le paiement (webhook IPN). En local, `localhost` n'est
pas joignable par la banque.

Solution en test : un tunnel **ngrok** (gratuit).

```powershell
# installer ngrok puis :
ngrok http 8000
```

ngrok donne une URL publique type `https://abc123.ngrok-free.app`.
Mets dans `.env` :

```
SOGECOMMERCE_IPN_URL=https://abc123.ngrok-free.app/payment/ipn
```

En production sur le VPS, ce sera simplement
`https://tousvospneus.com/payment/ipn` (pas de tunnel nécessaire).

## 4. Cartes de test Sogecommerce

En mode test, utilise les **numéros de carte fictifs** fournis dans la
doc Sogecommerce (Back Office → documentation → cartes de test).
Ils permettent de simuler : paiement accepté, refusé, 3D Secure
réussi/échoué, etc. **Aucun euro réel n'est débité.**

## 5. Tester le tunnel complet

```
docker compose up -d --build
docker compose exec api alembic upgrade head
# puis parcours : panier -> checkout -> paiement avec carte de test
```

## 6. Passage en PRODUCTION (plus tard)

Quand tout est validé en test, le passage en réel = **uniquement**
remplacer dans le `.env` :
- le mot de passe API de test par celui de production
- la clé HMAC de test par celle de production
- l'URL IPN par l'URL de production

**Aucune ligne de code à changer.** C'est tout l'intérêt de
l'architecture (interface `PaymentProvider`).

## Sécurité (rappel)

- La commande passe à `paid` UNIQUEMENT sur l'IPN serveur signé.
- La signature HMAC est vérifiée systématiquement (testé : un faux
  IPN est rejeté).
- Le retour navigateur du client n'a aucune valeur probante.
