import re
import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import AccountType, UserRole

# Email normalisé en minuscules dès la validation : la connexion cherche
# en lowercase (auth.service), donc un compte créé avec des majuscules
# serait introuvable au login. À utiliser sur toutes les ENTRÉES email.
NormalizedEmail = Annotated[EmailStr, AfterValidator(str.lower)]


# ---------- Inscription / connexion ----------

def _validate_siret_luhn(siret: str) -> bool:
    """Algorithme de Luhn appliqué au SIRET (14 chiffres)."""
    if not siret.isdigit() or len(siret) != 14:
        return False
    # Tout-zéro passe le Luhn (somme = 0) mais n'est pas un SIRET réel
    if siret == "0" * 14:
        return False
    total = 0
    for i, ch in enumerate(siret):
        n = int(ch)
        # Luhn : on double un chiffre sur deux EN PARTANT DE LA DROITE
        # (l'avant-dernier, puis tous les deux). Sur 14 chiffres, cela
        # correspond aux indices pairs depuis la gauche.
        if i % 2 == 0:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


class ProInfo(BaseModel):
    company_name: str = Field(min_length=2, max_length=255)
    # max_length > 14 : un SIRET saisi avec des espaces ("732 829 320 00074")
    # doit passer la validation de longueur AVANT que le validator ne
    # retire les espaces et vérifie les 14 chiffres.
    siret: str | None = Field(default=None, max_length=20)
    vat_number: str | None = Field(default=None, max_length=20)

    @field_validator("siret")
    @classmethod
    def validate_siret(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        v = v.replace(" ", "")
        if not _validate_siret_luhn(v):
            raise ValueError("SIRET invalide (14 chiffres, contrôle Luhn)")
        return v


class RegisterIn(BaseModel):
    email: NormalizedEmail
    password: str = Field(min_length=8, max_length=128)
    account_type: AccountType = AccountType.particulier
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    # Obligatoire si account_type == pro (validé côté service)
    pro: ProInfo | None = None


class LoginIn(BaseModel):
    email: NormalizedEmail
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshIn(BaseModel):
    refresh_token: str


class ForgotPasswordIn(BaseModel):
    email: NormalizedEmail


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class VerifyEmailIn(BaseModel):
    token: str


class AdminLoginOut(BaseModel):
    """Réponse au login admin.

    - Si 2FA non activé : retourne directement les tokens.
    - Si 2FA activé : retourne un pre_2fa_token, le client doit appeler
      /auth/admin/verify-2fa avec ce token + code TOTP pour obtenir les
      tokens finaux.
    """
    requires_2fa: bool = False
    pre_2fa_token: str | None = None
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"


class Verify2faIn(BaseModel):
    pre_2fa_token: str
    code: str = Field(min_length=6, max_length=6)


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
