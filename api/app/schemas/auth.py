import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import AccountType, UserRole


# ---------- Inscription / connexion ----------

class ProInfo(BaseModel):
    company_name: str = Field(min_length=2, max_length=255)
    siret: str | None = Field(default=None, max_length=14)
    vat_number: str | None = Field(default=None, max_length=20)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    account_type: AccountType = AccountType.particulier
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    # Obligatoire si account_type == pro (validé côté service)
    pro: ProInfo | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshIn(BaseModel):
    refresh_token: str


# ---------- Sorties ----------

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    account_type: AccountType
    role: UserRole
    first_name: str | None
    last_name: str | None
    phone: str | None
    email_verified: bool
    created_at: datetime


# ---------- Adresses ----------

class AddressIn(BaseModel):
    label: str | None = None
    line1: str
    line2: str | None = None
    postal_code: str
    city: str
    country: str = "FR"
    is_default: bool = False


class AddressOut(AddressIn):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
