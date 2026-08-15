import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class GarageBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(min_length=1, max_length=300)
    postal_code: str = Field(min_length=4, max_length=10)
    city: str = Field(min_length=1, max_length=120)
    phone: str | None = None
    email: EmailStr | None = None
    siret: str | None = None
    description: str | None = None
    hours: dict = {}
    mounting_price_cents: int = Field(default=0, ge=0)
    services: list[str] = []
    photo_url: str | None = None
    payment_methods: list[str] = []
    closures: list[dict] = []
    pricing: list[dict] = []
    # Prise de rendez-vous en ligne (réglages d'exploitation)
    appointments_enabled: bool = False
    slot_minutes: int = Field(default=30, ge=10, le=240)
    slot_capacity: int = Field(default=1, ge=1, le=20)
    appointment_lead_days: int = Field(default=1, ge=1, le=30)
    is_published: bool = True


class GarageCreate(GarageBase):
    pass


class GarageUpdate(BaseModel):
    """Tous les champs optionnels : mise à jour partielle."""

    name: str | None = Field(default=None, max_length=200)
    address: str | None = Field(default=None, max_length=300)
    postal_code: str | None = Field(default=None, max_length=10)
    city: str | None = Field(default=None, max_length=120)
    phone: str | None = None
    email: EmailStr | None = None
    siret: str | None = None
    description: str | None = None
    hours: dict | None = None
    mounting_price_cents: int | None = Field(default=None, ge=0)
    services: list[str] | None = None
    photo_url: str | None = None
    payment_methods: list[str] | None = None
    closures: list[dict] | None = None
    pricing: list[dict] | None = None
    appointments_enabled: bool | None = None
    slot_minutes: int | None = Field(default=None, ge=10, le=240)
    slot_capacity: int | None = Field(default=None, ge=1, le=20)
    appointment_lead_days: int | None = Field(default=None, ge=1, le=30)
    is_published: bool | None = None


class GarageOut(GarageBase):
    """Vue admin / propriétaire : complète."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    lat: float | None = None
    lng: float | None = None
    owner_user_id: uuid.UUID | None = None
    siret: str | None = None
    siret_verified: bool = False
    siret_company_name: str | None = None
    kbis_path: str | None = None
    photos: list = []


class GaragePublic(BaseModel):
    """Fiche publique d'un garage (page /garages/{slug})."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    address: str
    postal_code: str
    city: str
    phone: str | None = None
    email: EmailStr | None = None
    description: str | None = None
    hours: dict = {}
    mounting_price_cents: int = 0
    services: list[str] = []
    photo_url: str | None = None
    payment_methods: list[str] = []
    pricing: list[dict] = []
    photos: list = []
    lat: float | None = None
    lng: float | None = None
    appointments_enabled: bool = False


class OwnerIn(BaseModel):
    email: EmailStr


class PartnerRegisterIn(BaseModel):
    """Auto-inscription d'un garage partenaire (compte + fiche garage)."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    garage_name: str = Field(min_length=1, max_length=200)
    address: str = Field(min_length=1, max_length=300)
    postal_code: str = Field(min_length=4, max_length=10)
    city: str = Field(min_length=1, max_length=120)
    phone: str | None = None


class PartnerOrderItem(BaseModel):
    label: str
    quantity: int
    dimension: str | None = None


class PartnerOrder(BaseModel):
    """Commande vue par le garage : PAS de prix (montage réglé sur place)."""

    order_number: str
    status: str
    created_at: str
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_email: str | None = None
    items: list[PartnerOrderItem] = []
    mounting_at: str | None = None
    mounting_note: str | None = None


class AppointmentIn(BaseModel):
    mounting_at: str | None = None  # ISO 8601 ; None = annuler le RDV
    note: str | None = None


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    author_name: str
    rating: int
    comment: str | None = None
    created_at: str


class GarageNearby(BaseModel):
    """Vue publique : ce que le client voit au checkout. Pas de propriétaire."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    address: str
    postal_code: str
    city: str
    phone: str | None = None
    hours: dict = {}
    mounting_price_cents: int = 0
    services: list[str] = []
    photo_url: str | None = None
    # Coordonnées : nécessaires pour placer le garage sur la carte publique.
    lat: float | None = None
    lng: float | None = None
    distance_km: float | None = None
    # Le checkout n'affiche le choix du créneau que si le garage le propose.
    appointments_enabled: bool = False


class SlotOut(BaseModel):
    start: str  # ISO 8601, heure locale du garage
    available: bool


class SlotDayOut(BaseModel):
    date: str  # YYYY-MM-DD
    closure_label: str | None = None
    slots: list[SlotOut] = []


class SlotsOut(BaseModel):
    """Créneaux proposables pour le panier en cours."""

    enabled: bool
    # Livraison estimée des pneus au garage (None si le fournisseur ne la
    # donne pas : un délai de transport prudent est alors appliqué).
    delivery_estimate: str | None = None
    # Premier jour réservable = livraison estimée + délai du garage (J+1 min).
    earliest_date: str
    slot_minutes: int
    days: list[SlotDayOut] = []
