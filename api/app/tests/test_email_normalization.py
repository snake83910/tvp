"""Normalisation email + gardes-fous de configuration production."""
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.schemas.auth import ForgotPasswordIn, LoginIn, RegisterIn


def test_register_email_lowercase():
    """Un email saisi avec des majuscules est stocké en minuscules,
    sinon le login (qui cherche en lowercase) ne le retrouve jamais."""
    data = RegisterIn(email="Remy.SIMON@Gmail.com", password="unmotdepasse")
    assert data.email == "remy.simon@gmail.com"


def test_login_email_lowercase():
    data = LoginIn(email="ADMIN@TVP.FR", password="x")
    assert data.email == "admin@tvp.fr"


def test_forgot_password_email_lowercase():
    data = ForgotPasswordIn(email="Client@Example.COM")
    assert data.email == "client@example.com"


def test_production_refuse_jwt_secret_par_defaut():
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(environment="production", jwt_secret="CHANGE_ME",
                 payment_provider="sogecommerce")


def test_production_refuse_paiement_simule():
    with pytest.raises(ValidationError, match="simulated"):
        Settings(environment="production", jwt_secret="un_vrai_secret",
                 payment_provider="simulated")


def test_developpement_accepte_les_defauts():
    s = Settings(environment="development")
    assert s.payment_provider in ("simulated", "sogecommerce")
