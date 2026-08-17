"""Avis produits vérifiés.

Pourquoi les construire plutôt que d'acheter un abonnement. 1001pneus
affiche 9,4/10, Popgom 9/10 : sur un site que personne ne connaît et qui
réclame une carte bancaire, l'absence d'avis est le premier frein. Une
solution tierce facture au mois, exige un compte, et surtout renvoie
vers son propre domaine — alors que ce qui rapporte, ce sont les étoiles
dans les résultats Google, et elles viennent du balisage de NOTRE page.

Le mot « vérifié » n'est pas décoratif. Le formulaire n'existe qu'au
bout d'un lien signé, envoyé après livraison à qui a réellement reçu la
commande : il n'y a pas d'endroit où un inconnu puisse déposer un avis.

CADRE LÉGAL (art. L111-7-2 du code de la consommation). Trois obligations
qui se traduisent en code, pas en promesses :

  * dire si les avis sont vérifiés et comment — d'où la mention affichée
    sur la fiche produit, adossée au fait technique ci-dessus ;
  * afficher la date de chaque avis ;
  * ne pas écarter un avis parce qu'il est mauvais. La modération existe
    pour l'injure et l'illégal, elle exige un motif écrit, et elle ne
    regarde jamais la note.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import _create_token, decode_token
from app.models.catalog import ProductReview

#: 60 jours. Un client ne répond pas dans la semaine, et un lien mort
#: dans une boîte mail est une occasion perdue de récupérer un avis.
TOKEN_DAYS = 60

TOKEN_TYPE = "product_review"


def create_token(order_id: str) -> str:
    return _create_token(
        sub=order_id, claims={}, expires=timedelta(days=TOKEN_DAYS),
        token_type=TOKEN_TYPE,
    )


def read_token(token: str) -> str | None:
    """Identifiant de commande porté par le jeton, ou None."""
    try:
        payload = decode_token(token)
    except Exception:
        return None
    if payload.get("type") != TOKEN_TYPE:
        return None
    return payload.get("sub")


def author_name(first_name: str | None, last_name: str | None) -> str:
    """« Camille D. » — jamais le nom complet.

    Un avis est une page publique et indexée. Le prénom suffit à
    l'incarner ; le nom de famille en fait une donnée personnelle
    diffusée sans nécessité.
    """
    prenom = (first_name or "").strip() or "Client"
    initiale = (last_name or "").strip()[:1].upper()
    return f"{prenom} {initiale}." if initiale else prenom


@dataclass(frozen=True)
class Aggregate:
    """Moyenne et volume, pour l'affichage et le balisage."""

    count: int
    average: float

    @property
    def has_reviews(self) -> bool:
        return self.count > 0


async def aggregate_for(db: AsyncSession, supplier_ref: str) -> Aggregate:
    row = (await db.execute(
        select(func.count(ProductReview.id), func.avg(ProductReview.rating))
        .where(
            ProductReview.supplier_ref == supplier_ref,
            ProductReview.is_published.is_(True),
        )
    )).first()
    count = row[0] or 0
    # Arrondi au dixième : afficher 4,3333 sur une fiche produit fait
    # amateur, et Google n'en demande pas tant.
    return Aggregate(count=count, average=round(float(row[1] or 0), 1))


async def published_for(
    db: AsyncSession, supplier_ref: str, limit: int = 20
) -> list[ProductReview]:
    return list((await db.scalars(
        select(ProductReview)
        .where(
            ProductReview.supplier_ref == supplier_ref,
            ProductReview.is_published.is_(True),
        )
        .order_by(ProductReview.created_at.desc())
        .limit(limit)
    )).all())
