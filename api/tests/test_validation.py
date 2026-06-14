"""Tests des validateurs pure-Python (pas de DB requise)."""
import pytest
from pydantic import ValidationError

from app.schemas.auth import AddressIn, ProInfo, _validate_siret_luhn


# ── SIRET (Luhn) ──────────────────────────────────────────────────

def test_siret_luhn_valid():
    # SIRET réel généré : 73282932000074 (issu doc INSEE)
    assert _validate_siret_luhn("73282932000074") is True


def test_siret_luhn_invalid():
    # SIRET avec un chiffre modifié -> Luhn casse
    assert _validate_siret_luhn("73282932000075") is False


def test_siret_too_short():
    assert _validate_siret_luhn("123") is False


def test_siret_with_letters():
    assert _validate_siret_luhn("7328293200007A") is False


def test_proinfo_accepts_valid_siret():
    info = ProInfo(company_name="ACME", siret="73282932000074")
    assert info.siret == "73282932000074"


def test_proinfo_strips_spaces_in_siret():
    info = ProInfo(company_name="ACME", siret="732 829 320 00074")
    assert info.siret == "73282932000074"


def test_proinfo_rejects_invalid_siret():
    with pytest.raises(ValidationError):
        ProInfo(company_name="ACME", siret="00000000000000")


def test_proinfo_allows_no_siret():
    info = ProInfo(company_name="ACME")
    assert info.siret is None


# ── Adresse ────────────────────────────────────────────────────────

def test_address_valid_french():
    a = AddressIn(line1="12 rue de la Paix", postal_code="75001", city="Paris")
    assert a.postal_code == "75001"
    assert a.city == "Paris"
    assert a.country == "FR"


def test_address_postal_code_invalid_fr():
    with pytest.raises(ValidationError):
        AddressIn(line1="12 rue de la Paix", postal_code="ABCDE", city="Paris")


def test_address_postal_code_4_digits_fr():
    with pytest.raises(ValidationError):
        AddressIn(line1="12 rue de la Paix", postal_code="7500", city="Paris")


def test_address_line1_too_short():
    with pytest.raises(ValidationError):
        AddressIn(line1="aa", postal_code="75001", city="Paris")


def test_address_city_invalid_chars():
    with pytest.raises(ValidationError):
        AddressIn(line1="12 rue de la Paix", postal_code="75001", city="<script>")


def test_address_city_with_accents():
    # Doit accepter "Châlons-en-Champagne", "L'Haÿ-les-Roses"...
    a = AddressIn(line1="1 rue X", postal_code="51000", city="Châlons-en-Champagne")
    assert "Châlons" in a.city
