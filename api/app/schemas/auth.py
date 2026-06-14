import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

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
    label: str | None = Field(default=None, max_length=80)
    line1: str = Field(min_length=5, max_length=255)
    line2: str | None = Field(default=None, max_length=255)
    postal_code: str = Field(min_length=4, max_length=10)
    city: str = Field(min_length=2, max_length=120)
    country: str = Field(default="FR", min_length=2, max_length=2)
    is_default: bool = False

    @field_validator("postal_code")
    @classmethod
    def validate_postal_code(cls, v: str, info) -> str:
        v = v.strip()
        country = (info.data.get("country") or "FR").upper()
        if country == "FR" and not re.match(r"^\d{5}$", v):
            raise ValueError("Code postal invalide (5 chiffres pour la France)")
        return v

    @field_validator("city")
    @classmethod
    def validate_city(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^[\w\s\-\'\(\)\.]+$", v, re.UNICODE):
            raise ValueError("Nom de ville invalide")
        return v

    @field_validator("line1")
    @classmethod
    def validate_line1(cls, v: str) -> str:
        return v.strip()

    @field_validator("country")
    @classmethod
    def validate_country(cls, v: str) -> str:
        return v.strip().upper()


class AddressOut(AddressIn):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
