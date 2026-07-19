"""
Connecteur Maxityre / AD Tyres.

Repris de la logique du script existant, mais :
- asynchrone (httpx) au lieu de requests + threads
- secrets via settings (.env), jamais en dur
- jeton mis en cache et rafraîchi automatiquement
- normalisation robuste des dimensions (module catalog.normalize)
- AUCUN stockage de catalogue : interrogation à la volée, cache Redis court

Le jour où l'API dropship officielle est disponible : créer une 2e classe
implémentant SupplierConnector et changer le connecteur actif. Rien d'autre
ne bouge.
"""
import time

import httpx

from app.core.config import settings
from app.core.sanitize import sanitize_supplier_html
from app.integrations.supplier_base import SupplierConnector, SupplierTyre
from app.modules.catalog.normalize import map_season, parse_dimension

_CDN_IMG = "https://cdn.maxityre.com/assets/img/tyre/big/"

# Client httpx PARTAGÉ : les connexions TCP/TLS sont réutilisées entre
# les appels (une recherche = des dizaines de pages, un handshake TLS
# par page coûterait cher). Fermé proprement au shutdown (main.lifespan).
_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=5.0, read=15.0, write=10.0, pool=5.0)
        )
    return _client


async def aclose_shared_client() -> None:
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None


class MaxityreConnector(SupplierConnector):
    name = "maxityre"

    def __init__(self) -> None:
        self._token: str | None = None
        self._token_ts: float = 0.0
        self._token_ttl = 1800  # 30 min, on rafraîchit avant expiration

    # ---- Authentification --------------------------------------------------

    async def authenticate(self) -> None:
        if self._token and (time.time() - self._token_ts) < self._token_ttl:
            return  # jeton encore valide

        if not settings.maxityre_username or not settings.maxityre_password:
            raise RuntimeError(
                "Identifiants Maxityre manquants : configurer "
                "MAXITYRE_USERNAME / MAXITYRE_PASSWORD dans .env"
            )

        url = f"{settings.maxityre_base_url}/fr_FR/login_check"
        resp = await _get_client().post(
            url,
            headers={
                "ad-tyres-site": settings.maxityre_site_id,
                "content-type": "application/x-www-form-urlencoded",
            },
            data={
                "_username": settings.maxityre_username,
                "_password": settings.maxityre_password,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        token = data.get("token")
        if not token:
            raise RuntimeError("Maxityre : jeton absent de la réponse de login")
        self._token = token
        self._token_ts = time.time()

    def _headers(self) -> dict:
        return {
            "ad-tyres-site": settings.maxityre_site_id,
            "jwt": f"Bearer {self._token}",
        }

    # ---- Normalisation -----------------------------------------------------

    def _to_tyre(self, item: dict) -> SupplierTyre | None:
        try:
            profil = item.get("profil") or {}
            marque = profil.get("marque") or {}
            raw_dim = item.get("dimension", "") or ""
            dim = parse_dimension(raw_dim)

            price_ht = item.get("prixHt")
            if price_ht is None:
                return None
            price_ht = float(price_ht)

            image_id = item.get("imageB2bId")
            image_url = (
                f"{_CDN_IMG}{image_id}.jpg" if image_id else None
            )

            # Stock total (somme des offres) + livraison la plus rapide
            offers = item.get("offers") or []
            total_stock = None
            fastest_delivery = None
            if offers:
                total_stock = sum(int(o.get("stock") or 0) for o in offers)
                deliveries = [o.get("dateDelivery") for o in offers if o.get("dateDelivery")]
                if deliveries:
                    fastest_delivery = min(deliveries)

            return SupplierTyre(
                supplier_ref=str(item.get("id") or item.get("articleReference")),
                brand=marque.get("marque", "") or "",
                model=profil.get("profil", "") or "",
                raw_dimension=raw_dim,
                width=dim.width if dim else None,
                aspect_ratio=dim.aspect_ratio if dim else None,
                diameter=dim.diameter if dim else None,
                load_index=dim.load_index if dim else None,
                speed_rating=dim.speed_rating if dim else None,
                season=map_season(item.get("saison")),
                price_ht=price_ht,
                image_url=image_url,
                eu_label={
                    "noise": item.get("noise"),
                    "noise_class": item.get("noiseClass"),
                    "grip": item.get("grip"),
                    "wet": item.get("wet"),
                },
                brand_slug=marque.get("url") or None,
                # Enrichissements
                ean=str(item.get("ean")) if item.get("ean") else None,
                eprel_id=int(item["eprelId"]) if item.get("eprelId") else None,
                description_html=sanitize_supplier_html(
                    (profil.get("extraFields") or {}).get("description")
                ),
                is_runflat=bool(item.get("runflat")),
                is_xl=bool(item.get("specifXl") or item.get("renforce")),
                is_3pmsf=bool(item.get("specifSnow")),
                is_studded=bool(item.get("specifNorth")),
                stock=total_stock,
                delivery_estimate=fastest_delivery,
            )
        except (KeyError, ValueError, TypeError):
            # Un item malformé ne doit pas casser toute la recherche
            return None

    # ---- Recherche ---------------------------------------------------------

    async def _fetch_page(
        self,
        client: httpx.AsyncClient,
        url: str,
        width: int,
        height: int,
        diameter: int,
        page: int,
    ) -> dict:
        """Récupère une page de résultats avec retry simple.
        3 tentatives sur erreur réseau / 5xx, backoff 0.5s puis 1s."""
        import asyncio as _asyncio

        params = {
            "search_pneus_dimension[category]": "auto",
            "search_pneus_dimension[width]": width,
            "search_pneus_dimension[height]": height,
            "search_pneus_dimension[diameter]": diameter,
            "search_pneus_dimension[page]": page,
        }
        last_exc: Exception | None = None
        for attempt in range(3):
            try:
                resp = await client.get(
                    url, headers=self._headers(), params=params
                )
                if resp.status_code == 200:
                    return resp.json() or {}
                if 500 <= resp.status_code < 600:
                    # 5xx : retryable
                    last_exc = RuntimeError(f"HTTP {resp.status_code}")
                else:
                    return {}
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                last_exc = exc
            if attempt < 2:
                await _asyncio.sleep(0.5 * (attempt + 1))
        return {}

    async def search_by_dimension(
        self, width: int, height: int, diameter: int
    ) -> list[SupplierTyre]:
        """
        Récupère TOUTES les pages Maxityre pour la dimension.

        L'API pagine : details.nbResults = total, details.limit = taille
        de page. On lit la 1re page pour connaître le total, puis on
        récupère les pages restantes EN PARALLÈLE (pas en série, sinon
        le client attendrait N appels séquentiels).

        Garde-fou : MAXITYRE_MAX_PAGES borne le nombre de pages pour
        éviter une boucle si l'API renvoie un total aberrant.
        """
        await self.authenticate()
        url = f"{settings.maxityre_base_url}/search/pneus/dimension"

        import asyncio

        client = _get_client()
        first = await self._fetch_page(
            client, url, width, height, diameter, 1
        )
        if not first:
            return []

        details = first.get("details") or {}
        items = list(first.get("items") or [])

        nb_results = int(details.get("nbResults") or len(items))
        limit = int(details.get("limit") or len(items) or 20)
        if limit <= 0:
            limit = 20

        # Nombre total de pages, borné par sécurité
        total_pages = (nb_results + limit - 1) // limit
        total_pages = min(total_pages, settings.maxityre_max_pages)

        if total_pages > 1:
            # Pages 2..N en parallèle
            tasks = [
                self._fetch_page(
                    client, url, width, height, diameter, p
                )
                for p in range(2, total_pages + 1)
            ]
            for res in await asyncio.gather(
                *tasks, return_exceptions=True
            ):
                if isinstance(res, dict) and res:
                    items.extend(res.get("items") or [])

        out: list[SupplierTyre] = []
        for it in items:
            tyre = self._to_tyre(it)
            if tyre is not None:
                out.append(tyre)
        return out

    async def get_by_ref(self, supplier_ref: str) -> SupplierTyre | None:
        """Fiche produit détaillée via /pneu/{id}.

        L'endpoint de recherche /search/pneus/dimension renvoie une version
        allégée (sans EAN, EPREL, description, spécificités, stock). Pour
        afficher la fiche produit complète, on appelle l'endpoint détail.
        """
        await self.authenticate()
        url = f"{settings.maxityre_base_url}/pneu/{supplier_ref}"
        try:
            resp = await _get_client().get(url, headers=self._headers())
            if resp.status_code != 200:
                return None
            body = resp.json()
            # L'API enveloppe la fiche dans {"tyre": {...}}
            item = body.get("tyre") if isinstance(body, dict) else None
            if not item:
                return None
        except (httpx.TimeoutException, httpx.NetworkError):
            return None

        return self._to_tyre_detailed(item)

    def _to_tyre_detailed(self, item: dict) -> SupplierTyre | None:
        """Parse la réponse détaillée de /pneu/{id}.

        Structure différente du search : largeur/hauteur/diametre au lieu de
        dimension parsée, prixHt présent, profil enrichi avec description.
        """
        try:
            profil = item.get("profil") or {}
            marque = profil.get("marque") or {}
            raw_dim = item.get("dimension", "") or ""

            price_ht = item.get("prixHt")
            if price_ht is None:
                return None
            price_ht = float(price_ht)

            image_id = item.get("imageB2bId")
            image_url = f"{_CDN_IMG}{image_id}.jpg" if image_id else None

            offers = item.get("offers") or []
            total_stock = sum(int(o.get("stock") or 0) for o in offers) if offers else None
            deliveries = [o.get("dateDelivery") for o in offers if o.get("dateDelivery")]
            fastest_delivery = min(deliveries) if deliveries else None

            speed = item.get("vitesse") or None

            return SupplierTyre(
                supplier_ref=str(item.get("id") or item.get("articleReference")),
                brand=marque.get("marque", "") or "",
                model=profil.get("profil", "") or "",
                raw_dimension=raw_dim,
                width=int(item["largeur"]) if item.get("largeur") else None,
                aspect_ratio=int(item["hauteur"]) if item.get("hauteur") else None,
                diameter=int(item["diametre"]) if item.get("diametre") else None,
                load_index=int(item["charge"]) if item.get("charge") else None,
                speed_rating=speed,
                season=map_season(item.get("saison")),
                price_ht=price_ht,
                image_url=image_url,
                eu_label={
                    "noise": item.get("noise"),
                    "noise_class": item.get("noiseClass"),
                    "grip": item.get("grip"),
                    "wet": item.get("wet"),
                },
                brand_slug=marque.get("url") or None,
                ean=str(item.get("ean")) if item.get("ean") else None,
                eprel_id=int(item["eprelId"]) if item.get("eprelId") else None,
                description_html=sanitize_supplier_html(
                    (profil.get("extraFields") or {}).get("description")
                ),
                is_runflat=bool(item.get("runflat")),
                is_xl=bool(item.get("specifXl") or item.get("renforce")),
                is_3pmsf=bool(item.get("specifSnow")),
                is_studded=bool(item.get("specifNorth")),
                stock=total_stock,
                delivery_estimate=fastest_delivery,
            )
        except (KeyError, ValueError, TypeError):
            return None
