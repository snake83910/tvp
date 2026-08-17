"""Dépôt et lecture des avis produits.

Aucun endpoint n'exige de session : le jeton d'invitation authentifie à
lui seul, parce qu'un client invité n'a pas de mot de passe et qu'on ne
va pas lui en faire inventer un pour noter ses pneus.
"""
import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError, ErrorCode
from app.core.rate_limit import rate_limit
from app.db.session import get_db
from app.models.catalog import ProductReview
from app.models.order import Order, OrderStatus
from app.models.user import User
from app.modules.catalog import reviews
from app.schemas.catalog import (
    ProductReviewOut,
    ReviewContextOut,
    ReviewItemOut,
    ReviewsBlockOut,
    ReviewSubmitIn,
)

router = APIRouter(prefix="/reviews", tags=["reviews"])


async def _order_from_token(token: str, db: AsyncSession) -> Order:
    order_id = reviews.read_token(token)
    if not order_id:
        raise AppError(
            status_code=400,
            code=ErrorCode.BAD_REQUEST,
            message="Lien expiré ou invalide. Les invitations sont valables 60 jours.",
        )
    try:
        oid = uuid.UUID(order_id)
    except ValueError:
        raise AppError(
            status_code=400, code=ErrorCode.BAD_REQUEST, message="Lien invalide."
        ) from None

    order = await db.scalar(
        select(Order).where(Order.id == oid).options(selectinload(Order.items))
    )
    if order is None:
        raise AppError(
            status_code=404, code=ErrorCode.NOT_FOUND, message="Commande introuvable."
        )
    # Le jeton n'est émis qu'après livraison, mais une commande peut
    # avoir été annulée ou remboursée depuis : noter un produit qu'on a
    # rendu n'a pas de sens.
    if order.status != OrderStatus.delivered:
        raise AppError(
            status_code=409,
            code=ErrorCode.CONFLICT,
            message="Cette commande n'est plus ouverte aux avis.",
        )
    return order


@router.get("/context", response_model=ReviewContextOut)
async def review_context(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Ce que le client peut noter, et ce qu'il a déjà noté."""
    order = await _order_from_token(token, db)

    deja = set((await db.scalars(
        select(ProductReview.supplier_ref).where(
            ProductReview.order_id == order.id
        )
    )).all())

    return ReviewContextOut(
        order_number=order.order_number,
        items=[
            ReviewItemOut(
                supplier_ref=it.supplier_ref,
                label=it.label_snapshot,
                already_reviewed=it.supplier_ref in deja,
            )
            # Un même pneu peut figurer deux fois : on ne le propose
            # qu'une fois, la contrainte d'unicité porte sur la paire
            # (commande, référence).
            for it in {i.supplier_ref: i for i in order.items}.values()
        ],
    )


# Chemin sans barre oblique finale. Avec, FastAPI expose `/v1/reviews/`
# et le proxy du front redirige vers la forme sans barre : une
# redirection sur un POST fait perdre le corps de la requête, et
# l'utilisateur voit « échec » alors que rien n'est parti.
@router.post("", status_code=201)
async def submit_reviews(
    data: ReviewSubmitIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Enregistre les avis d'une commande.

    Publiés immédiatement, et c'est un choix : seul un acheteur livré
    peut arriver ici, le risque de spam est nul, et retenir les avis en
    file de modération reviendrait à choisir lesquels paraissent.
    """
    await rate_limit(request, "review_submit", max_attempts=20, window_seconds=3600)
    order = await _order_from_token(data.token, db)

    user = await db.get(User, order.user_id)
    nom = reviews.author_name(
        user.first_name if user else None, user.last_name if user else None
    )
    labels = {i.supplier_ref: i.label_snapshot for i in order.items}

    ajoutes = 0
    for note in data.reviews:
        if note.supplier_ref not in labels:
            raise AppError(
                status_code=400,
                code=ErrorCode.BAD_REQUEST,
                message="Ce produit ne figure pas dans la commande.",
            )
        db.add(ProductReview(
            order_id=order.id,
            user_id=order.user_id,
            supplier_ref=note.supplier_ref,
            label_snapshot=labels[note.supplier_ref],
            author_name=nom,
            rating=note.rating,
            comment=(note.comment or "").strip() or None,
        ))
        ajoutes += 1

    try:
        await db.commit()
    except IntegrityError:
        # Contrainte (commande, référence) : le lien a été rejoué, ou
        # deux onglets ont été validés. Ce n'est pas une erreur du
        # client, on le lui dit sans dramatiser.
        await db.rollback()
        raise AppError(
            status_code=409,
            code=ErrorCode.CONFLICT,
            message="Vous avez déjà donné votre avis sur cette commande.",
        ) from None

    return {"created": ajoutes}


@router.get("/product/{supplier_ref}", response_model=ReviewsBlockOut)
async def product_reviews(
    supplier_ref: str,
    db: AsyncSession = Depends(get_db),
):
    """Avis publiés d'une référence, avec la moyenne."""
    agg = await reviews.aggregate_for(db, supplier_ref)
    rows = await reviews.published_for(db, supplier_ref)
    return ReviewsBlockOut(
        count=agg.count,
        average=agg.average,
        reviews=[
            ProductReviewOut(
                author_name=r.author_name,
                rating=r.rating,
                comment=r.comment,
                created_at=r.created_at,
            )
            for r in rows
        ],
    )
