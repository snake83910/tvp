"""Helper pour journaliser une action dans la table audit_logs.

Usage typique dans un endpoint admin :
    await audit(db, user=current_user, action="order.status_change",
                target_type="order", target_id=order.order_number,
                payload={"from": "paid", "to": "shipped"}, request=request)
"""
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.user import User


def _client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None


async def audit(
    db: AsyncSession,
    user: User | None,
    action: str,
    target_type: str,
    target_id: str | None = None,
    payload: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    log = AuditLog(
        actor_id=user.id if user else None,
        actor_email=user.email if user else None,
        action=action,
        target_type=target_type,
        target_id=target_id,
        payload=payload,
        ip=_client_ip(request),
    )
    db.add(log)
    # Pas de commit ici : laissé au caller (incorporé dans sa transaction)
