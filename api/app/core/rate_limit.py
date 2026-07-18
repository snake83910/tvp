"""Rate limiting basé sur Redis (compteur + TTL).

Pas de dépendance externe (slowapi, etc.) : compteur INCR atomique
avec EXPIRE à la première occurrence. Léger, suffisant pour bloquer
le brute force basique.
"""
from fastapi import HTTPException, Request, status

from app.core.cache import get_redis
from app.core.net import client_ip


async def rate_limit(
    request: Request,
    key_prefix: str,
    max_attempts: int = 5,
    window_seconds: int = 60,
) -> None:
    """Lève HTTP 429 si l'IP dépasse max_attempts dans la fenêtre.

    Le compteur est incrémenté à chaque appel ; quand il dépasse le seuil,
    on refuse pendant la durée restante de la fenêtre.
    """
    ip = client_ip(request) or "unknown"

    redis_key = f"rl:{key_prefix}:{ip}"
    redis = get_redis()
    count = await redis.incr(redis_key)
    if count == 1:
        await redis.expire(redis_key, window_seconds)
    if count > max_attempts:
        ttl = await redis.ttl(redis_key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Trop de tentatives. Réessayez dans {max(ttl, 1)}s.",
            headers={"Retry-After": str(max(ttl, 1))},
        )
