"""Format d'erreur unique de l'API.

Pourquoi : jusqu'ici, `detail` était une chaîne dans presque tous les cas
mais un objet pour le conflit de stock, et le frontend en était réduit à
tester le message français pour décider quoi afficher
(`if (/compte existe déjà/i.test(msg))`). Traduire l'API, ou seulement
reformuler une phrase, cassait silencieusement le tunnel de commande.

Toute erreur renvoie désormais la même enveloppe :

    {
      "code":    "email_taken",              # stable, machine-lisible
      "message": "Un compte existe déjà…",   # humain, français, libre
      "details": {...},                      # contexte typé, optionnel
      "detail":  "Un compte existe déjà…"    # rétro-compatibilité
    }

`detail` est conservé parce que des clients (dont l'app mobile à venir,
et les écrans front pas encore migrés) le lisent déjà. Il porte toujours
le même texte que `message` : aucun appelant n'a besoin de connaître les
deux, mais aucun ne casse.

Le `code` est le contrat. Le `message` ne l'est pas : il peut changer,
être traduit ou reformulé sans qu'aucun client ne s'en aperçoive.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

log = logging.getLogger(__name__)


class ErrorCode:
    """Codes d'erreur stables. À traiter comme une API publique : on en
    ajoute, on n'en renomme pas."""

    # Générique — repli quand aucun code précis n'a été posé
    BAD_REQUEST = "bad_request"
    UNAUTHORIZED = "unauthorized"
    FORBIDDEN = "forbidden"
    NOT_FOUND = "not_found"
    CONFLICT = "conflict"
    VALIDATION_ERROR = "validation_error"
    RATE_LIMITED = "rate_limited"
    INTERNAL_ERROR = "internal_error"

    # Comptes
    EMAIL_TAKEN = "email_taken"
    INVALID_CREDENTIALS = "invalid_credentials"
    OTP_INVALID = "otp_invalid"
    EMAIL_NOT_VERIFIED = "email_not_verified"

    # Panier / commande
    CART_EMPTY = "cart_empty"
    STOCK_INSUFFICIENT = "stock_insufficient"
    TERMS_NOT_ACCEPTED = "terms_not_accepted"

    # Rendez-vous de montage
    APPOINTMENTS_DISABLED = "appointments_disabled"
    SLOT_TOO_EARLY = "slot_too_early"
    SLOT_NOT_OFFERED = "slot_not_offered"
    SLOT_TAKEN = "slot_taken"
    APPOINTMENT_LOCKED = "appointment_locked"

    # Espace partenaire
    GARAGE_FIELDS_LOCKED = "garage_fields_locked"
    NO_GARAGE_FOR_ACCOUNT = "no_garage_for_account"

    # Fournisseur / services externes
    SUPPLIER_UNCONFIGURED = "supplier_unconfigured"
    SUPPLIER_UNAVAILABLE = "supplier_unavailable"
    PLATE_LOOKUP_UNAVAILABLE = "plate_lookup_unavailable"


# Repli par statut HTTP quand une HTTPException est levée sans code —
# le client garde ainsi TOUJOURS un `code` exploitable, même sur les
# erreurs pas encore qualifiées.
_STATUS_FALLBACK = {
    400: ErrorCode.BAD_REQUEST,
    401: ErrorCode.UNAUTHORIZED,
    403: ErrorCode.FORBIDDEN,
    404: ErrorCode.NOT_FOUND,
    409: ErrorCode.CONFLICT,
    422: ErrorCode.VALIDATION_ERROR,
    429: ErrorCode.RATE_LIMITED,
}


class AppError(HTTPException):
    """Erreur métier portant un code stable.

    S'utilise comme une HTTPException ordinaire — elle en hérite, donc
    tout le code existant qui attrape HTTPException continue de marcher.
    """

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(status_code=status_code, detail=message, headers=headers)
        self.code = code
        self.message = message
        self.details = details or {}


def _payload(code: str, message: str, details: dict | None = None) -> dict:
    return {
        "code": code,
        "message": message,
        "details": details or {},
        # Rétro-compatibilité : les clients existants lisent `detail`.
        "detail": message,
    }


def install_error_handlers(app: FastAPI) -> None:
    """Branche les gestionnaires qui normalisent TOUTES les sorties d'erreur."""

    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload(exc.code, exc.message, exc.details),
            headers=exc.headers,
        )

    @app.exception_handler(HTTPException)
    async def _http_error(_: Request, exc: HTTPException) -> JSONResponse:
        """HTTPException nue : on lui attribue un code de repli.

        `detail` peut historiquement être un dict (le conflit de stock le
        faisait). On le remonte alors dans `details` plutôt que de le
        stringifier en « [object Object] » côté client.
        """
        details: dict = {}
        if isinstance(exc.detail, dict):
            details = dict(exc.detail)
            message = str(details.pop("message", "")) or "Erreur"
        else:
            message = str(exc.detail)
        code = _STATUS_FALLBACK.get(exc.status_code, ErrorCode.INTERNAL_ERROR)
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload(code, message, details),
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """422 de Pydantic : un champ fautif par entrée, exploitable pour
        surligner le bon input côté formulaire."""
        fields = [
            {
                # loc = ("body", "email") -> "email"
                "field": ".".join(str(p) for p in err.get("loc", ())[1:]) or None,
                "message": err.get("msg", ""),
                "type": err.get("type", ""),
            }
            for err in exc.errors()
        ]
        first = fields[0]["message"] if fields else "Requête invalide"
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_payload(
                ErrorCode.VALIDATION_ERROR, first, {"fields": fields}
            ),
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        """Filet de sécurité : une exception non prévue ne doit jamais
        renvoyer une trace ni un message technique au client."""
        log.exception("Erreur non gérée sur %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_payload(
                ErrorCode.INTERNAL_ERROR,
                "Une erreur interne est survenue. Réessayez dans un instant.",
            ),
        )
