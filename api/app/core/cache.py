"""Cache Redis : prix/dispo fournisseur volatils, on ne stocke pas en DB."""
import json

import redis.asyncio as aioredis

from app.core.config import settings

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.redis_url, encoding="utf-8", decode_responses=True
        )
    return _redis


async def cache_get(key: str):
    raw = await get_redis().get(key)
    return json.loads(raw) if raw else None


async def cache_set(key: str, value, ttl: int) -> None:
    await get_redis().set(key, json.dumps(value), ex=ttl)
