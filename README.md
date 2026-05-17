# tousvospneus.com — Phase 1 (socle)

Backend FastAPI : authentification + comptes B2C/B2B + adresses.
Validé de bout en bout (inscription, login, JWT, refresh, gardes de rôle).

## Démarrage

```bash
cp .env.example .env
# éditer .env : générer JWT_SECRET avec  openssl rand -hex 32

docker compose up -d                 # postgres + redis + api

# Première migration (dans le conteneur api)
docker compose exec api alembic upgrade head
```

API : http://localhost:8000 — doc interactive : http://localhost:8000/docs

## Ce qui est livré (phase 1)

| Élément | Statut |
|---|---|
| Config centralisée (pydantic-settings) | ✅ |
| Sécurité : bcrypt + JWT access/refresh | ✅ |
| Modèles : User / ProProfile / Address | ✅ |
| Axes séparés `account_type` ≠ `role` | ✅ |
| Auth : register / login / refresh / me | ✅ |
| Garde de rôle `require_role(...)` | ✅ |
| Comptes : profil + CRUD adresses | ✅ |
| Migration Alembic initiale | ✅ |
| Doc OpenAPI auto (réutilisable app mobile) | ✅ |

## Parcours validé

```
1. Inscription particulier        201  account_type=particulier role=client
2. Inscription pro sans société   422  (société obligatoire pour un pro)
3. Inscription pro avec société   201  account_type=pro
4. Email en doublon               409
5. Login                          200  access + refresh token
6. /auth/me avec token            200
7. /auth/me sans token            401
8. Refresh token                  200  nouveau access token
9. Login mauvais mot de passe     401
10. Ajout + liste adresses        201 / 200
```

## Tests

```bash
docker compose up -d
RUN_E2E=1 pytest          # test e2e du parcours auth
```

## Suite — Phase 2 (premier produit vendable)

Catalogue (référence fournisseur sans stock) → moteur de marge
→ panier → checkout → paiement Sogecommerce → commande
→ transmission fournisseur.

## Phase 2 — LIVRÉE (catalogue + marge)

Fournisseur : Maxityre / AD Tyres (`api.maxityre.com`).

| Élément | Statut |
|---|---|
| Interface abstraite `SupplierConnector` | ✅ |
| `MaxityreConnector` (async, secrets via .env) | ✅ |
| Aucun stockage catalogue — temps réel + cache Redis | ✅ |
| Parsing dimensions robuste (regex ancrée) | ✅ testé |
| → utilitaire `C`, indices doubles, ZR, XL | ✅ |
| → format pouces US REFUSÉ (jamais de faux) | ✅ |
| Moteur de marge (`pricing_rules` en base) | ✅ |
| Marge 10 % par défaut + arrondi `.90` | ✅ |
| Affichage pro = HT / particulier = TTC | ✅ |
| Prix d'achat fournisseur jamais exposé | ✅ vérifié |
| Migration `phase2_suppliers_pricing_rules` + seed | ✅ |
| `GET /search/dimensions` | ✅ |

Config requise dans `.env` : `MAXITYRE_USERNAME` / `MAXITYRE_PASSWORD`
(voir `.env.example`). Sans ça, la recherche lève une erreur explicite.

### Tests

```bash
docker compose up -d
docker compose exec api alembic upgrade head
docker compose exec api python -m pytest app/tests/test_normalize.py -q
```

## Phase 3 — LIVRÉE (panier + commande + paiement)

| Élément | Statut |
|---|---|
| Panier serveur, anonyme + fusion à la connexion | ✅ |
| Prix figé à l'ajout (anti-litige) | ✅ |
| Checkout : revalidation prix vs Maxityre | ✅ testé |
| → si écart : commande bloquée + écarts signalés | ✅ |
| Machine à états commande (transitions contrôlées) | ✅ testé |
| → aucun saut d'état possible | ✅ |
| Montants en centimes (jamais de float pour l'argent) | ✅ |
| Interface paiement abstraite | ✅ |
| `SimulatedPayment` (dev, sans contrat) | ✅ |
| Ossature `SogecommercePayment` (HMAC posé) | ✅ |
| Webhook IPN : signature + idempotence | ✅ testé |
| → commande payée UNIQUEMENT via IPN signé | ✅ |
| Migration `phase3_cart_order_payment` | ✅ |

Endpoints : `/cart`, `/cart/items`, `/cart/merge`, `/cart/checkout`,
`/payment/init/{order}`, `/payment/ipn`.

Paiement en mode `simulated` tant que le contrat Sogecommerce n'est
pas actif. Bascule = `PAYMENT_PROVIDER=sogecommerce` + clés du contrat
dans `.env`. Aucun autre code à changer.

```bash
docker compose exec api python -m pytest app/tests/ -q   # 13 verts
```

## Suite — Phase 4+

Recherche par plaque → livraison (domicile / garage partenaire)
→ espaces client / partenaire / admin → doc API publique.

## Rappel : démarches non techniques en parallèle (délais longs)

1. Contrat dropship grossiste (flux API + livraison neutre)
2. Contrat Sogecommerce (acceptation banque — priorité, délai long)
3. Accès API SIV (plaque → véhicule)
4. **Demander à AD Tyres/Maxityre leur accès API dropship officiel**
   (l'accès actuel via login site est fonctionnel mais fragile)
5. **Sécurité : changer les mots de passe Maxityre et FTP** (exposés)
