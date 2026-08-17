"""Paiement en plusieurs fois : disponibilité et interrupteur.

Séparé de `integrations/alma.py`, qui ne parle qu'HTTP. Ici vivent les
deux questions que se pose le site : est-ce activé, et que peut-on
proposer sur CE montant.

L'interrupteur est en base et non dans le `.env` : le compte Alma
n'existe pas encore, et le jour où il existera il faudra pouvoir allumer
le moyen de paiement depuis le navigateur — puis l'éteindre aussi vite
si quelque chose cloche un samedi après-midi, sans redéploiement.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations import alma
from app.models.setting import AppSetting

SETTING_KEY = "alma_enabled"

#: Éteint par défaut. Un moyen de paiement ne s'allume pas tout seul à
#: la faveur d'un déploiement : c'est une décision, elle se prend dans
#: l'administration.
DEFAULT = False


async def is_enabled(db: AsyncSession) -> bool:
    value = await db.scalar(
        select(AppSetting.value).where(AppSetting.key == SETTING_KEY)
    )
    if value is None:
        return DEFAULT
    return value == "1"


async def set_enabled(db: AsyncSession, enabled: bool) -> None:
    """Allume ou éteint. Refuse d'allumer sans clé d'API : un bouton
    « payer en 3 fois » qui mène à une erreur coûte la vente, et le
    client n'y revient pas."""
    if enabled and not alma.configured():
        raise ValueError(
            "Clé d'API Alma absente (ALMA_API_KEY). Renseignez-la dans "
            "l'environnement du serveur avant d'activer le paiement en "
            "plusieurs fois."
        )
    row = await db.get(AppSetting, SETTING_KEY)
    if row is None:
        db.add(AppSetting(key=SETTING_KEY, value="1" if enabled else "0"))
    else:
        row.value = "1" if enabled else "0"


async def options_for(db: AsyncSession, amount_cents: int) -> list[int]:
    """Échéanciers affichables pour ce montant : [] si rien à proposer.

    Trois conditions, dans l'ordre du moins cher au plus cher à
    évaluer : l'interrupteur, la clé, puis l'appel à Alma. On interroge
    Alma parce que ses planchers et plafonds dépendent du contrat et du
    nombre d'échéances — annoncer un 4x qu'il refusera au dernier écran
    est la pire façon de perdre un client.
    """
    if not await is_enabled(db) or not alma.configured():
        return []
    return await alma.eligibility(amount_cents)
