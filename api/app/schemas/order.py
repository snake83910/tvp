import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.auth import AddressIn, FrenchPhone, NormalizedEmail


class AddItemIn(BaseModel):
    supplier_ref: str
    width: int
    ratio: int
    diameter: float  # poids lourd : 22.5
    quantity: int = 2  # défaut métier pneu : par essieu
    # Famille de véhicule : la revalidation prix/stock au checkout doit
    # rechercher dans le BON catalogue fournisseur
    category: str = "auto"

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        from app.integrations.supplier_base import VEHICLE_CATEGORIES
        if v not in VEHICLE_CATEGORIES:
            raise ValueError(
                f"Catégorie inconnue. Valeurs : {', '.join(VEHICLE_CATEGORIES)}"
            )
        return v


class UpdateQtyIn(BaseModel):
    quantity: int


class CartItemOut(BaseModel):
    id: uuid.UUID
    supplier_ref: str
    label: str
    quantity: int
    price_ht: float
    price_ttc: float
    # Enrichissements d'affichage (depuis product_data ; None pour les
    # lignes créées avant que le snapshot ne les stocke)
    dimension: str | None = None
    image_url: str | None = None
    season: str | None = None
    # Famille de véhicule (frais de port + affichage adaptés)
    category: str = "auto"


class CartOut(BaseModel):
    id: uuid.UUID | None = None
    session_token: str | None = None
    items: list[CartItemOut] = []
    total_ht: float = 0
    total_ttc: float = 0
    # Frais de port calculés par le serveur (app.modules.shipping.rules) :
    # le front les AFFICHE sans dupliquer la règle métier.
    shipping_ht: float = 0
    shipping_ttc: float = 0
    free_shipping: bool = False
    grand_total_ttc: float = 0
    # Livraison estimée du panier : la plus tardive des lignes (une
    # commande part en un seul envoi). None si le fournisseur ne la donne
    # pas. Sert de plancher au choix du créneau de montage.
    delivery_estimate: str | None = None


class PriceChangeOut(BaseModel):
    supplier_ref: str
    label: str
    old_ttc: float
    new_ttc: float

class CheckoutIn(BaseModel):
    address_id: uuid.UUID
    # None = facturation identique à la livraison
    billing_address_id: uuid.UUID | None = None
    delivery_mode: str = "home"
    # Requis si delivery_mode == "partner_garage" : garage de montage choisi
    garage_id: uuid.UUID | None = None
    # Créneau de montage choisi par le client (ISO 8601, heure locale du
    # garage). Optionnel : seuls les garages ayant activé la prise de RDV
    # en ligne en proposent. Revalidé côté serveur.
    mounting_at: str | None = None
    accept_terms: bool
    promo_code: str | None = None


class PromoCodeIn(BaseModel):
    """Création/édition d'un code promo (admin)."""
    code: str = Field(min_length=3, max_length=40)
    description: str | None = Field(default=None, max_length=255)
    discount_type: str  # "percent" | "amount"
    discount_value: int = Field(gt=0)
    min_articles_ttc_cents: int = Field(default=0, ge=0)
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    max_uses: int | None = Field(default=None, ge=1)
    once_per_user: bool = False
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def _normalize_code(cls, v: str) -> str:
        v = v.strip().upper()
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError(
                "Code : lettres, chiffres, tirets et underscores uniquement"
            )
        return v

    @field_validator("discount_type")
    @classmethod
    def _check_type(cls, v: str) -> str:
        if v not in ("percent", "amount"):
            raise ValueError("discount_type : 'percent' ou 'amount'")
        return v

    @field_validator("discount_value")
    @classmethod
    def _check_value(cls, v: int, info) -> int:
        if info.data.get("discount_type") == "percent" and v > 100:
            raise ValueError("Un pourcentage ne peut pas dépasser 100")
        return v


class PromoCodeUpdate(BaseModel):
    """Édition partielle (admin) — tous les champs optionnels."""
    description: str | None = None
    discount_type: str | None = None
    discount_value: int | None = Field(default=None, gt=0)
    min_articles_ttc_cents: int | None = Field(default=None, ge=0)
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    max_uses: int | None = Field(default=None, ge=1)
    once_per_user: bool | None = None
    is_active: bool | None = None


class PromoCodeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    description: str | None
    discount_type: str
    discount_value: int
    min_articles_ttc_cents: int
    valid_from: datetime | None
    valid_until: datetime | None
    max_uses: int | None
    once_per_user: bool
    is_active: bool
    created_at: datetime
    # Utilisations = commandes non annulées portant ce code
    uses: int = 0


class PromoValidateIn(BaseModel):
    code: str


class PromoValidateOut(BaseModel):
    valid: bool
    reason: str | None = None
    code: str | None = None
    description: str | None = None
    discount_ttc: float = 0
    
class CheckoutResult(BaseModel):
    # Si price_changes non vide : commande NON créée, confirmation requise
    order_number: str | None = None
    status: str | None = None
    total_ttc: float | None = None
    price_changes: list[PriceChangeOut] = []


class GuestCheckoutIn(BaseModel):
    """Commande sans compte préalable.

    L'inscription forcée est l'un des premiers postes d'abandon en
    e-commerce. On collecte donc les seules informations sans lesquelles
    la commande ne peut pas exister (email pour la confirmation et le
    suivi, identité et adresse pour la livraison et la facture), et on
    crée le compte en arrière-plan : tout l'aval (commande, facture,
    emails, espace client) continue de reposer sur un utilisateur réel,
    sans branche « commande orpheline » à maintenir.

    Le compte créé n'a pas de mot de passe utilisable. Le client le
    revendique quand il veut via « mot de passe oublié », ce qui prouve
    au passage qu'il possède bien l'adresse email.
    """

    email: NormalizedEmail
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    # Obligatoire : ce numéro accompagne l'adresse chez le fournisseur.
    phone: FrenchPhone

    shipping: AddressIn
    # None = facturation identique à la livraison
    billing: AddressIn | None = None

    delivery_mode: str = "home"
    garage_id: uuid.UUID | None = None
    mounting_at: str | None = None
    accept_terms: bool
    promo_code: str | None = None


class GuestCheckoutResult(CheckoutResult):
    """Résultat du checkout invité.

    Porte en plus une paire de jetons : le tunnel de paiement
    (`/payment/init/{order}`) exige un utilisateur authentifié, et le
    client vient précisément de créer sa commande dans cette session. Les
    jetons ne sont émis que pour un compte créé à l'instant — jamais pour
    une adresse email déjà enregistrée, qui est refusée en amont.
    """

    access_token: str | None = None
    refresh_token: str | None = None


class PaymentInitOut(BaseModel):
    provider: str
    provider_ref: str
    form_token: str
    amount_cents: int
    public_key: str = ""


class OrderOut(BaseModel):
    order_number: str
    status: str
    total_ht: float
    total_vat: float
    total_ttc: float


class OrderSummary(BaseModel):
    order_number: str
    status: str
    created_at: datetime
    total_ttc: float
    item_count: int


class OrderItemDetail(BaseModel):
    supplier_ref: str
    label: str
    quantity: int
    unit_price_ht: float
    unit_price_ttc: float
    line_total_ttc: float


class OrderDetail(BaseModel):
    order_number: str
    status: str
    created_at: datetime
    paid_at: datetime | None

    # Adresses figées (facturation = livraison si non dissociée)
    delivery_mode: str
    shipping_address: dict
    billing_address: dict = {}

    # Montage en garage partenaire : fiche figée du garage + créneau
    # réservé (heure locale du garage). Vides pour une livraison à domicile.
    garage: dict = {}
    mounting_at: str | None = None
    mounting_note: str | None = None

    # Numéro de facture (assigné au paiement)
    invoice_number: int | None = None
    # Numéro de facture d'avoir (série AV), présent dès qu'un
    # remboursement a été enregistré. Pilote l'affichage du bouton de
    # téléchargement côté client comme côté admin.
    credit_note_number: int | None = None

    # Code promo appliqué + remise TTC (0 si aucun)
    promo_code: str | None = None
    discount_ttc: float = 0

    # Suivi expédition (visible client uniquement si statut shipped/delivered)
    tracking_number: str | None = None
    carrier: str | None = None
    tracking_url: str | None = None

    # Articles
    items: list[OrderItemDetail]

    # Montants (en €)
    articles_ht: float
    articles_ttc: float
    shipping_ht: float
    shipping_ttc: float
    total_ht: float
    total_vat: float
    total_ttc: float


# ── Admin ──────────────────────────────────────────────────────────

class AdminOrderSummary(BaseModel):
    order_number: str
    status: str
    created_at: datetime
    total_ttc: float
    item_count: int
    customer_email: str
    customer_name: str | None = None


class AdminOrderDetail(OrderDetail):
    customer_email: str
    customer_name: str | None = None
    allowed_transitions: list[str]
    admin_note: str | None = None
    # Remboursement effectivement enregistré (euros), sa date, et son
    # origine : « sogecommerce » (exécuté par l'API, preuve archivée) ou
    # « manual » (déclaré par un admin).
    refunded: float | None = None
    refunded_at: datetime | None = None
    refund_mode: str | None = None
    #: Le remboursement automatique est-il possible sur cette instance ?
    #: Pilote l'écran admin : sans clés REST, seule la déclaration
    #: manuelle est proposée.
    refund_api_available: bool = False
    # Dernière réponse de la banque sur le paiement, pour les commandes
    # bloquées en attente : c'est ce qui explique pourquoi la relance ne
    # les a pas annulées.
    payment_check_result: str | None = None
    payment_checked_at: datetime | None = None
    # Transmission au panier fournisseur : date et compte rendu par
    # article (prix d'achat du jour, articles introuvables, retards).
    supplier_pushed_at: datetime | None = None
    supplier_push_result: dict | None = None


class StatusUpdateIn(BaseModel):
    status: str
    tracking_number: str | None = None
    carrier: str | None = None
    tracking_url: str | None = None
    cancel_reason: str | None = None
    # Montant à rembourser, en centimes. OBLIGATOIRE pour passer une
    # commande en « remboursée » : sans montant, rien ne permet de
    # vérifier après coup ce qui a été rendu, ni combien.
    refund_cents: int | None = None
    # True = l'admin déclare un remboursement DÉJÀ effectué à la main au
    # Back Office. Par défaut le site appelle lui-même la banque. Le
    # drapeau est explicite parce que les deux n'ont pas la même valeur
    # probante : l'un porte une réponse bancaire, l'autre une parole.
    refund_manual: bool = False


class PlateProviderIn(BaseModel):
    """Choix du fournisseur d'immatriculation (voir catalog/plate.py)."""
    mode: str


class EmailTemplateIn(BaseModel):
    """Contenu d'un template d'email saisi depuis l'administration."""
    html: str


class EmailPreviewIn(BaseModel):
    """Source à prévisualiser, avant même d'être enregistrée."""
    html: str


class AdminStats(BaseModel):
    orders_by_status: dict[str, int]
    revenue_total_ttc: float
    orders_today: int
    revenue_today_ttc: float
    # Étendu
    orders_30d: int = 0
    revenue_30d_ttc: float = 0.0
    avg_cart_ttc: float = 0.0
    top_products: list[dict] = []  # [{ref, label, qty, revenue_ttc}]
    # Comparatif période précédente (jours -30..-60)
    revenue_prev30_ttc: float = 0.0
    orders_prev30: int = 0


class OrderTrackingIn(BaseModel):
    """Suivi sans connexion : le numéro identifie, l'email authentifie."""

    order_number: str = Field(min_length=4, max_length=32)
    email: NormalizedEmail


class OrderTrackingOut(BaseModel):
    """Vue RESTREINTE, volontairement.

    Ni adresse postale, ni nom, ni détail des prix : ce couple
    numéro + email est plus facile à obtenir qu'une session (il suffit
    d'avoir vu passer l'email de confirmation). On rend l'avancement et
    le suivi transporteur, pas le dossier client.
    """

    order_number: str
    status: str
    created_at: datetime
    paid_at: datetime | None = None
    delivery_mode: str
    total_ttc: float
    item_count: int
    #: Libellés des articles, sans les prix unitaires.
    items: list[str] = []
    tracking_number: str | None = None
    carrier: str | None = None
    tracking_url: str | None = None
    garage_name: str | None = None
    garage_city: str | None = None


class AdminCustomerAddress(BaseModel):
    """Adresse par défaut d'un client, telle qu'enregistrée dans son
    carnet — à ne pas confondre avec l'adresse figée dans une commande,
    que le client a pu modifier depuis."""
    label: str | None = None
    line1: str
    line2: str | None = None
    postal_code: str
    city: str
    country: str = "FR"


class AdminCustomer(BaseModel):
    """Ligne de la liste clients (admin).

    Les agrégats portent sur les commandes RÉELLEMENT payées (paid,
    sent_to_supplier, shipped, delivered) : même définition du chiffre
    d'affaires que /admin/stats, pour que les deux écrans concordent.
    last_order_at, lui, couvre tous les statuts — un panier en attente
    de paiement reste un signe d'activité utile à voir.
    """
    id: uuid.UUID
    email: str
    name: str | None = None
    phone: str | None = None
    account_type: str
    role: str
    company_name: str | None = None
    # Raison sociale du garage pour un compte partenaire. Sans elle, la
    # ligne s'affichait « — » : un partenaire n'a ni prénom ni nom.
    garage_name: str | None = None
    email_verified: bool
    # Compte créé par une commande sans inscription. Rend « non vérifié »
    # interprétable : sur un invité, c'est la norme tant qu'il n'a pas
    # saisi son code ; sur un inscrit, c'est un signal.
    is_guest: bool = False
    created_at: datetime
    orders_count: int = 0
    revenue_ttc: float = 0.0
    last_order_at: datetime | None = None
    # Adresse par défaut + nombre total, pour que l'admin sache qu'il en
    # existe d'autres plutôt que de croire celle-ci unique.
    address: AdminCustomerAddress | None = None
    addresses_count: int = 0
