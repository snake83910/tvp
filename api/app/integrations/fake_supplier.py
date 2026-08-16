"""Connecteur fournisseur déterministe, pour les tests de bout en bout.

Les e2e tapaient le vrai catalogue Maxityre. Conséquence : le stock est
réel, donc il s'épuise — une référence ajoutée au panier par un run
n'était plus commandable au suivant, et la suite virait au rouge pour une
raison sans aucun rapport avec le code. Deux exécutions rapprochées ne
passaient pas. Une suite qui crie au loup finit par être ignorée, ce qui
est pire que pas de suite du tout.

Ce connecteur rend un catalogue stable, largement stocké, sans réseau.
Il n'est JAMAIS choisi par défaut : il faut poser `SUPPLIER_PROVIDER=fake`
explicitement. Et s'il l'était par erreur en production, la supercherie
saute aux yeux — les marques annoncent ce qu'elles sont.

Le vrai connecteur reste testé par la suite e2e « live », lancée à la
main : c'est elle qui vérifie que Maxityre répond toujours comme prévu.
"""
from app.integrations.supplier_base import SupplierConnector, SupplierTyre

# Assez de références pour que les filtres, facettes et tris aient de la
# matière, mais pas au point de ralentir les tests.
_MODELS = [
    ("TestGrip", "TG-Sport", "premium", "ete", 82.50, True),
    ("TestGrip", "TG-Winter", "premium", "hiver", 91.00, True),
    ("Essai", "EX-Confort", "quality", "ete", 61.20, False),
    ("Essai", "EX-4Saisons", "quality", "4saisons", 68.40, False),
    ("Banc", "BC-Eco", "discount", "ete", 44.90, False),
]


# Préfixe des références du bouchon. NUMÉRIQUE, comme celles de
# Maxityre : l'URL canonique d'une fiche produit se termine par la
# référence (« marque-modele-<ref> ») et son analyse reprend le dernier
# segment séparé par un tiret. Une référence contenant un tiret casserait
# donc la fiche — un bouchon qui s'en écarterait testerait autre chose que
# la réalité, et masquerait le vrai comportement.
_PREFIX = "99"


def _ref(width: int, height: int, diameter: float, index: int) -> str:
    """Référence stable : le même pneu garde la même clé d'un run à
    l'autre, ce qui rend les échecs reproductibles."""
    d = f"{diameter:g}".replace(".", "")
    return f"{_PREFIX}{width}{height}{d}{index}"


class FakeConnector(SupplierConnector):
    name = "fake"

    async def authenticate(self) -> None:
        return None

    def _tyre(
        self, width: int, height: int, diameter: float, index: int, category: str
    ) -> SupplierTyre:
        brand, model, tier, season, price, premium = _MODELS[index % len(_MODELS)]
        return SupplierTyre(
            supplier_ref=_ref(width, height, diameter, index),
            brand=brand,
            model=model,
            raw_dimension=f"{width}/{height} R{diameter:g}",
            width=width,
            aspect_ratio=height,
            diameter=diameter,
            load_index=91,
            speed_rating="V",
            season=season,
            price_ht=price,
            image_url=None,
            eu_label={"noise": 70, "noise_class": "B", "grip": "B", "wet": "A"},
            brand_slug=brand.lower(),
            brand_tier=tier,
            ean=f"30000000000{index:02d}",
            eprel_id=None,
            description_html=None,
            is_runflat=False,
            is_xl=premium,
            is_3pmsf=season in ("hiver", "4saisons"),
            is_studded=False,
            # Large exprès : c'est tout l'intérêt du bouchon. Un test ne
            # doit jamais échouer parce qu'un run précédent a « acheté ».
            stock=99,
            delivery_estimate=None,
            market_prices=[],
        )

    async def search_by_dimension(
        self,
        width: int,
        height: int,
        diameter: float,
        category: str = "auto",
    ) -> list[SupplierTyre]:
        return [
            self._tyre(width, height, diameter, i, category)
            for i in range(len(_MODELS))
        ]

    async def get_by_ref(self, supplier_ref: str) -> SupplierTyre | None:
        """Reconstruit le pneu depuis sa référence : le bouchon n'a pas
        d'état, une fiche produit reste donc consultable même sans avoir
        joué la recherche avant."""
        if not supplier_ref.startswith(_PREFIX) or not supplier_ref.isdigit():
            return None
        try:
            body = supplier_ref[len(_PREFIX) :]
            width = int(body[:3])
            height = int(body[3:5])
            index = int(body[-1])
            # Diamètre encodé sans point : « 16 » -> 16, « 225 » -> 22.5
            rest = body[5:-1]
            diameter = float(rest) if len(rest) <= 2 else float(rest) / 10
            return self._tyre(width, height, diameter, index, "auto")
        except (ValueError, IndexError):
            return None
