# tousvospneus.com — Architecture Phase 1

> Document de référence technique — Phase 1 (socle).
> SAS tousvospneus.com · SIREN 977 671 965 · TVA FR38 977 671 965
> Modèle : dropshipping (sans stock) · B2C + B2B · API-first

---

## 1. Stack technique

| Couche | Techno | Rôle |
|---|---|---|
| API | FastAPI (Python 3.12) + Pydantic v2 | Backend, doc OpenAPI auto |
| Base de données | PostgreSQL 16 (JSONB + PostGIS) | Source de vérité transactionnelle |
| ORM / migrations | SQLAlchemy 2.0 async + Alembic | Modèle de données versionné |
| Cache / files | Redis | Cache prix/dispo, plaques, sessions |
| Jobs asynchrones | arq | Sync fournisseur, commandes, emails |
| Frontend | Next.js 14 (App Router) + Tailwind | SSR pour SEO + 3 espaces |
| Auth | JWT (python-jose) + bcrypt | Web + future app, scopes/rôles |
| Paiement | API REST Sogecommerce/PayZen | Form token + webhook IPN |
| Infra | Docker Compose + nginx (VPS) | api/web/db/redis/worker/nginx |
| Emails | Brevo ou Postmark | Transactionnel |

**Principe directeur** : monolithe modulaire, modules à frontières nettes
(catalogue, plaque, paiement, livraison, comptes). Un seul humain aux commandes
→ pas de microservices.

---

## 2. Concepts fondateurs (à ne jamais violer)

1. **Le prix HT est l'unique source de vérité.** Le TTC est calculé à
   l'affichage selon le type de client. On ne stocke jamais un TTC figé.
2. **Pas de catalogue fournisseur stocké.** Un produit = une référence légère
   vers un SKU fournisseur + une règle de marge. Prix/dispo récupérés à la
   volée avec cache court.
3. **Deux axes indépendants** :
   - `account_type` : `particulier` / `pro` → impacte prix, TVA, facturation
   - `role` : `client` / `garage` / `admin` → impacte droits et dashboards
4. **La marge est une fonction**, pas une constante :
   `marge(prix_fournisseur, account_type, volume)`.
5. **Le paiement n'est jamais validé sur le retour navigateur** — uniquement
   sur le webhook IPN serveur, signature HMAC vérifiée, traitement idempotent.

---

## 3. Schéma PostgreSQL (Phase 1)

### 3.1 Comptes & authentification

```sql
-- Type de client : impacte prix/TVA/facturation
CREATE TYPE account_type AS ENUM ('particulier', 'pro');
-- Rôle applicatif : impacte droits/dashboards
CREATE TYPE user_role   AS ENUM ('client', 'garage', 'admin');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    account_type    account_type NOT NULL DEFAULT 'particulier',
    role            user_role    NOT NULL DEFAULT 'client',
    first_name      TEXT,
    last_name       TEXT,
    phone           TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bloc pro : présent uniquement si account_type = 'pro'
CREATE TABLE pro_profiles (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    company_name    TEXT NOT NULL,
    siret           TEXT,
    vat_number      TEXT,                 -- validé via VIES
    vat_validated   BOOLEAN NOT NULL DEFAULT FALSE,
    price_tier      TEXT NOT NULL DEFAULT 'standard',  -- grille tarifaire
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE addresses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label       TEXT,                     -- "Domicile", "Atelier"...
    line1       TEXT NOT NULL,
    line2       TEXT,
    postal_code TEXT NOT NULL,
    city        TEXT NOT NULL,
    country     TEXT NOT NULL DEFAULT 'FR',
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.2 Catalogue (référence fournisseur, sans stock)

```sql
CREATE TABLE suppliers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    api_base    TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- Une ligne = un pneu chez un fournisseur. PAS de prix figé ici.
CREATE TABLE supplier_products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    supplier_sku    TEXT NOT NULL,
    ean             TEXT,
    brand           TEXT NOT NULL,
    model           TEXT NOT NULL,
    -- Dimensions normalisées pour la recherche
    width           INT,        -- 205
    aspect_ratio    INT,        -- 55
    diameter        INT,        -- 16  (R16)
    load_index      INT,        -- 91
    speed_rating    TEXT,       -- V
    season          TEXT,       -- ete / hiver / 4saisons
    -- Données hétérogènes brutes du fournisseur
    raw_specs       JSONB,
    eu_label        JSONB,      -- conso / adhérence / bruit
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (supplier_id, supplier_sku)
);

CREATE INDEX idx_sp_dims
  ON supplier_products (width, aspect_ratio, diameter);
CREATE INDEX idx_sp_brand  ON supplier_products (brand);
CREATE INDEX idx_sp_season ON supplier_products (season);

-- Règles de marge : la marge est une FONCTION
CREATE TABLE pricing_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_type    account_type,         -- NULL = s'applique à tous
    price_tier      TEXT,                  -- NULL = tous les tiers
    brand           TEXT,                  -- NULL = toutes marques
    markup_percent  NUMERIC(5,2) NOT NULL, -- ex : 18.00
    markup_floor    NUMERIC(8,2),          -- marge mini en €
    price_floor     NUMERIC(8,2),          -- prix de vente plancher
    rounding        TEXT DEFAULT 'psych',  -- ex : .90
    priority        INT NOT NULL DEFAULT 0,-- règle la plus spécifique gagne
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);
```

> Le **prix HT de vente** n'existe nulle part en colonne : il est calculé en
> temps réel = `prix_fournisseur` (API, caché Redis) → `pricing_rules` →
> prix HT → TTC à l'affichage selon `account_type`.

### 3.3 Véhicules & recherche plaque

```sql
-- Cache : une plaque = un véhicule stable
CREATE TABLE vehicle_lookups (
    plate           TEXT PRIMARY KEY,      -- normalisée AA-123-AA
    make            TEXT,
    model           TEXT,
    version         TEXT,
    year            INT,
    vin             TEXT,
    -- dimensions pneu d'origine (peut être multi-valeurs)
    tyre_fitments   JSONB,
    source          TEXT,                  -- api SIV utilisée
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.4 Commandes & paiement

```sql
CREATE TYPE order_status AS ENUM (
    'cart', 'pending_payment', 'paid',
    'sent_to_supplier', 'shipped', 'delivered',
    'fitted', 'cancelled', 'refunded'
);

CREATE TYPE delivery_mode AS ENUM ('home', 'partner_garage');

CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number        TEXT UNIQUE NOT NULL,   -- séquentiel, voir invoices
    user_id             UUID NOT NULL REFERENCES users(id),
    status              order_status NOT NULL DEFAULT 'cart',
    account_type_snapshot account_type NOT NULL, -- figé à la commande
    delivery_mode       delivery_mode,
    delivery_address_id UUID REFERENCES addresses(id),
    partner_garage_id   UUID,                   -- FK garages (phase 6)
    -- Montants figés au paiement (en centimes, HT + TVA séparés)
    total_ht_cents      INT,
    total_vat_cents     INT,
    total_ttc_cents     INT,
    currency            TEXT NOT NULL DEFAULT 'EUR',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at             TIMESTAMPTZ
);

CREATE TABLE order_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    supplier_product_id UUID NOT NULL REFERENCES supplier_products(id),
    -- snapshot produit au moment de l'achat (le catalogue bouge)
    label_snapshot      TEXT NOT NULL,
    quantity            INT NOT NULL CHECK (quantity > 0),
    unit_price_ht_cents INT NOT NULL,
    vat_rate            NUMERIC(4,2) NOT NULL DEFAULT 20.00,
    eco_tax_cents       INT NOT NULL DEFAULT 0   -- REP pneumatiques
);

CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id),
    provider        TEXT NOT NULL DEFAULT 'sogecommerce',
    provider_ref    TEXT,                  -- transaction id PayZen
    amount_cents    INT NOT NULL,
    status          TEXT NOT NULL,         -- authorised / captured / failed
    ipn_payload     JSONB,                 -- preuve, audit
    ipn_signature_ok BOOLEAN,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_ref)        -- idempotence webhook
);

-- Facturation conforme FR : numérotation séquentielle sans trou
CREATE TABLE invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL UNIQUE REFERENCES orders(id),
    invoice_number  BIGINT GENERATED ALWAYS AS IDENTITY,  -- séquence stricte
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    pdf_path        TEXT,
    total_ht_cents  INT NOT NULL,
    total_vat_cents INT NOT NULL,
    total_ttc_cents INT NOT NULL
);
```

---

## 4. Endpoints FastAPI (Phase 1)

```
AUTH
  POST   /auth/register            inscription (particulier|pro)
  POST   /auth/login               -> JWT (scope account_type, role)
  POST   /auth/refresh
  GET    /auth/me

COMPTE
  GET    /me/profile
  PATCH  /me/profile
  GET    /me/addresses
  POST   /me/addresses
  PATCH  /me/addresses/{id}
  DELETE /me/addresses/{id}

CATALOGUE & RECHERCHE
  GET    /search/dimensions        ?width=205&ratio=55&diameter=16&season=
  GET    /products/{id}            détail + prix calculé (selon le token)
  GET    /products/{id}/price      prix HT/TTC pour le client courant

RECHERCHE PLAQUE
  GET    /vehicle/plate/{plate}    -> véhicule + montes pneu (caché)
  GET    /vehicle/{id}/tyres       -> produits compatibles

PANIER & COMMANDE
  GET    /cart
  POST   /cart/items
  PATCH  /cart/items/{id}
  DELETE /cart/items/{id}
  POST   /cart/checkout            -> crée order pending_payment

PAIEMENT
  POST   /payment/form-token       -> token Sogecommerce/PayZen
  POST   /payment/ipn              webhook serveur (HMAC, idempotent)
  GET    /payment/return           page retour (NE valide PAS la commande)

COMMANDES & FACTURES (client)
  GET    /me/orders
  GET    /me/orders/{id}
  GET    /me/orders/{id}/invoice   PDF

ADMIN (role=admin)
  GET    /admin/pricing-rules
  POST   /admin/pricing-rules
  GET    /admin/orders
  GET    /admin/suppliers/sync-status
```

> La doc OpenAPI complète est générée automatiquement par FastAPI
> (`/docs` et `/openapi.json`) → réutilisable telle quelle par l'app mobile.

---

## 5. Arborescence projet

```
tousvospneus/
├── docker-compose.yml
├── .env                       # secrets : NE PAS committer
├── nginx/
│   └── tousvospneus.conf
│
├── api/                       # FastAPI
│   ├── Dockerfile
│   ├── alembic/               # migrations
│   ├── app/
│   │   ├── main.py
│   │   ├── core/              # config, sécurité, JWT
│   │   ├── db/                # session, base SQLAlchemy
│   │   ├── models/            # tables ORM
│   │   ├── schemas/           # Pydantic (contrats API)
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── accounts/
│   │   │   ├── catalog/       # supplier_products + pricing
│   │   │   ├── pricing/       # moteur de marge
│   │   │   ├── vehicle/       # recherche plaque
│   │   │   ├── cart/
│   │   │   ├── orders/
│   │   │   ├── payment/       # Sogecommerce + IPN
│   │   │   └── invoicing/
│   │   ├── integrations/
│   │   │   ├── supplier_*.py  # client API grossiste
│   │   │   ├── siv.py         # API plaque
│   │   │   ├── vies.py        # validation TVA
│   │   │   └── sogecommerce.py
│   │   └── workers/           # tâches arq
│   └── tests/
│
└── web/                       # Next.js 14
    ├── Dockerfile
    ├── app/
    │   ├── (shop)/            # catalogue, recherche, produit
    │   ├── (account)/         # espace client
    │   ├── (partner)/         # espace garage
    │   ├── (admin)/           # espace admin
    │   └── api/               # route handlers (proxy léger)
    ├── components/
    ├── lib/                   # client API typé
    └── styles/                # Tailwind, charte noir/rouge
```

---

## 6. Démarches NON techniques en parallèle (bloquantes)

Ces 3 points conditionnent le projet et ont des délais longs — à lancer
maintenant, en parallèle du dev :

1. **Contrat dropship grossiste** avec flux API + livraison neutre
   (sans marque identifiant le fournisseur).
2. **Contrat Sogecommerce** : ~33 €HT/mois + ~300 €HT raccordement, sous
   réserve d'acceptation banque + contrat de flux internet. Délai bancaire
   long → priorité.
3. **Accès API SIV** (plaque → véhicule) auprès d'un fournisseur licencié.

À cadrer avec un comptable : éco-participation REP pneumatiques, TVA B2C/B2B,
rétractation 14j (B2C uniquement), étiquetage pneu UE, mentions légales.

---

## 7. Ordre de construction

| Phase | Contenu | Vendable ? |
|---|---|---|
| **1** | Squelette API, auth, schéma DB, catalogue + sync (lecture), recherche dimensions | — |
| **2** | Panier, checkout, paiement Sogecommerce, commande, transmission fournisseur | ✅ MVP |
| 3 | Recherche par plaque | |
| 4 | Modes de livraison + annuaire garages | |
| 5 | Espace client complet + facturation PDF | |
| 6 | Espace partenaire garage | |
| 7 | Durcissement espace admin | |
| 8 | Doc API publique pour app mobile | |

Phases 1 + 2 = déjà un produit qui encaisse.
