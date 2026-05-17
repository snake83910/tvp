"""
Contrat que tout connecteur fournisseur doit respecter.

Permet de changer de fournisseur (ou de passer de l'accès "site" à l'API
officielle Maxityre) sans toucher au reste du code. Une seule implémentation
réelle aujourd'hui (Maxityre) ; une factice pour les tests.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class SupplierTyre:
    """Produit normalisé, indépendant du fournisseur."""

    supplier_ref: str          # référence unique chez le fournisseur
    brand: str
    model: str
    raw_dimension: str
    width: int | None
    aspect_ratio: int | None
    diameter: int | None
    load_index: int | None
    speed_rating: str | None
    season: str                # ete / hiver / 4saisons / inconnu
    price_ht: float            # prix d'ACHAT fournisseur (jamais affiché tel quel)
    image_url: str | None = None
    eu_label: dict = field(default_factory=dict)  # bruit / adhérence / conso


class SupplierConnector(ABC):
    """Interface. MaxityreConnector aujourd'hui, autres demain."""

    name: str = "abstract"

    @abstractmethod
    async def authenticate(self) -> None:
        """Obtient/rafraîchit le jeton d'accès si nécessaire."""

    @abstractmethod
    async def search_by_dimension(
        self, width: int, height: int, diameter: int
    ) -> list[SupplierTyre]:
        """Recherche les pneus pour une dimension donnée."""

    @abstractmethod
    async def get_by_ref(self, supplier_ref: str) -> SupplierTyre | None:
        """Récupère un pneu précis (prix/dispo frais)."""
