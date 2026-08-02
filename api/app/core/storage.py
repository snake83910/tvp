"""Stockage simple de fichiers uploadés (Kbis…) sur disque.

Le dossier de base (settings.upload_dir) est monté sur un volume persistant
en production. On ne stocke que le chemin RELATIF en base.
"""
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings

_ALLOWED = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
}
_MAX_BYTES = 5 * 1024 * 1024  # 5 Mo


async def save_document(subdir: str, name: str, upload: UploadFile) -> str:
    """Valide et enregistre un document. Renvoie le chemin relatif stocké."""
    ext = _ALLOWED.get((upload.content_type or "").lower())
    if ext is None:
        raise HTTPException(
            status_code=400, detail="Format accepté : PDF, JPG ou PNG"
        )
    data = await upload.read()
    if not data:
        raise HTTPException(status_code=400, detail="Fichier vide")
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (5 Mo max)")
    base = Path(settings.upload_dir) / subdir
    base.mkdir(parents=True, exist_ok=True)
    rel = f"{subdir}/{name}{ext}"
    (Path(settings.upload_dir) / rel).write_bytes(data)
    return rel


def document_path(rel: str) -> Path:
    """Chemin absolu d'un document à partir de son chemin relatif stocké."""
    return Path(settings.upload_dir) / rel
