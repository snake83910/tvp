"""
Contrat que tout connecteur fournisseur doit respecter.

Permet de changer de fournisseur (ou de passer de l'accès "site" à l'API
officielle Maxityre) sans toucher au reste du code. Une seule implémentation
réelle aujourd'hui (Maxityre) ; une factice pour les tests.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

# Familles de véhicules supportées par la recherche Maxityre
# (valeurs EXACTES attendues par search_pneus_dimension[category]).
# "quad" est accepté par l'API mais le catalogue fournisseur est vide à
# ce jour : la catégorie s'activera d'elle-même quand ils l'alimenteront.
VEHICLE_CATEGORIES = ("auto", "moto", "quad", "camion", "agricole")


@dataclass
class SupplierTyre:
    """Produit normalisé, indépendant du fournisseur."""

    supplier_ref: str          # référence unique chez le fournisseur
    brand: str
    model: str
    raw_dimension: str
    width: int | None
    aspect_ratio: int | None
    # float : les poids lourds roulent en 17.5 / 19.5 / 22.5 pouces
    diameter: float | None
    load_index: int | None
    speed_rating: str | None
    season: str                # ete / hiver / 4saisons / inconnu
    price_ht: float            # prix d'ACHAT fournisseur (jamais affiché tel quel)
    image_url: str | None = None
    eu_label: dict = field(default_factory=dict)  # bruit / adhérence / conso
    brand_slug: str | None = None  # slug brand pour récupérer le logo CDN
    # Enrichissements (optionnels, dépendent du fournisseur)
    ean: str | None = None             # code-barre EAN-13
    eprel_id: int | None = None        # identifiant étiquette EPREL UE
    description_html: str | None = None  # description longue HTML
    is_runflat: bool = False
    is_xl: bool = False                # renforcé
    is_3pmsf: bool = False             # symbole montagne + 3 pics (homologué hiver)
    is_studded: bool = False           # cloutable
    stock: int | None = None
    delivery_estimate: str | None = None  # ISO 8601


class SupplierConnector(ABC):
    """Interface. MaxityreConnector aujourd'hui, autres demain."""

    name: str = "abstract"

    @abstractmethod
    async def authenticate(self) -> None:
        """Obtient/rafraîchit le jeton d'accès si nécessaire."""

    @abstractmethod
    async def search_by_dimension(
        self,
        width: int,
        height: int,
        diameter: float,
        category: str = "auto",
    ) -> list[SupplierTyre]:
        """Recherche les pneus pour une dimension donnée dans une
        famille de véhicules (auto / moto / quad / camion / agricole)."""

    @abstractmethod
    async def get_by_ref(self, supplier_ref: str) -> SupplierTyre | None:
        """Récupère un pneu précis (prix/dispo frais)."""
