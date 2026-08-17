import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(120), unique=True)
    connector: Mapped[str] = mapped_column(String(60))  # "maxityre"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PricingRule(Base):
    """
    La marge est une FONCTION paramétrable, pas une constante.
    La règle la plus prioritaire applicable gagne.

    Phase 2 : une seule règle par défaut (markup 10 %, tous publics).
    Le modèle gère déjà la différenciation future (account_type, marque...).
    """

    __tablename__ = "pricing_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # NULL = s'applique à tous
    account_type: Mapped[str | None] = mapped_column(String(20))
    price_tier: Mapped[str | None] = mapped_column(String(50))
    brand: Mapped[str | None] = mapped_column(String(80))

    markup_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=10.00)
    markup_floor: Mapped[float | None] = mapped_column(Numeric(8, 2))
    price_floor: Mapped[float | None] = mapped_column(Numeric(8, 2))
    rounding: Mapped[str] = mapped_column(String(10), default="psych")  # .90

    priority: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ProductReview(Base):
    """Avis client sur un pneu, après livraison.

    Sur invitation UNIQUEMENT : le formulaire n'existe qu'au bout d'un
    lien signé, envoyé à qui a réellement reçu la commande. C'est ce qui
    permet d'écrire « avis vérifiés » sans mentir, et ce qui rend la
    pré-modération inutile — d'où `is_published` à vrai par défaut.

    L'avis est rattaché à la COMMANDE autant qu'au produit : c'est elle
    qui prouve l'achat, et elle qui empêche de noter deux fois.

    `is_published` ne sert qu'à retirer l'illégal ou l'injurieux. Le
    droit de la consommation interdit d'écarter un avis pour la seule
    raison qu'il est mauvais ; `moderation_reason` existe pour que ce
    choix reste explicite et relisible.
    """

    __tablename__ = "product_reviews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    #: Référence fournisseur du pneu noté. Index : c'est la clé de
    #: lecture de la fiche produit.
    supplier_ref: Mapped[str] = mapped_column(String(64), index=True)
    #: Libellé figé au moment de l'avis. Le catalogue fournisseur change,
    #: les références disparaissent : sans ce snapshot, un avis ancien
    #: n'aurait plus de nom de produit à afficher.
    label_snapshot: Mapped[str] = mapped_column(String(255))
    #: Prénom + initiale, calculés à l'enregistrement. On n'affiche
    #: jamais le nom complet d'un client sur une page publique.
    author_name: Mapped[str] = mapped_column(String(120))
    rating: Mapped[int] = mapped_column(Integer)  # 1..5
    comment: Mapped[str | None] = mapped_column(Text)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    moderation_reason: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    __table_args__ = (
        # Un avis par produit et par commande. La contrainte est en base
        # et pas seulement dans le code : le lien d'invitation peut être
        # rejoué, et deux onglets ouverts suffisent à doubler l'envoi.
        UniqueConstraint("order_id", "supplier_ref", name="uq_review_order_ref"),
    )
