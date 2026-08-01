import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class GarageBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(min_length=1, max_length=300)
    postal_code: str = Field(min_length=4, max_length=10)
    city: str = Field(min_length=1, max_length=120)
    phone: str | None = None
    email: EmailStr | None = None
    description: str | None = None
    hours: dict = {}
    mounting_price_cents: int = Field(default=0, ge=0)
    services: list[str] = []
    photo_url: str | None = None
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
    description: str | None = None
    hours: dict | None = None
    mounting_price_cents: int | None = Field(default=None, ge=0)
    services: list[str] | None = None
    photo_url: str | None = None
    is_published: bool | None = None


class GarageOut(GarageBase):
    """Vue admin / propriétaire : complète."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    lat: float | None = None
    lng: float | None = None
    owner_user_id: uuid.UUID | None = None


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
    distance_km: float | None = None
