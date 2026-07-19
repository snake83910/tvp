"""Assainissement du HTML tiers (descriptions produit fournisseur).

Le frontend injecte description_html via dangerouslySetInnerHTML : tout
HTML venant de Maxityre doit passer ici AVANT d'être servi. Si le flux
fournisseur est compromis un jour, un <script> ne doit jamais atteindre
le navigateur des clients.
"""
import re

try:
    import nh3

    _ALLOWED_TAGS = {
        "p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li",
        "h2", "h3", "h4", "table", "thead", "tbody", "tr", "td", "th",
        "span", "div",
    }

    def sanitize_supplier_html(html: str | None) -> str | None:
        if not html:
            return None
        # Aucun attribut autorisé : pas de style/onload/href fournisseur
        return nh3.clean(html, tags=_ALLOWED_TAGS, attributes={}) or None

except ImportError:  # nh3 absent : on retire TOUT le balisage (fail-safe)
    _TAG_RE = re.compile(r"<[^>]*>")

    def sanitize_supplier_html(html: str | None) -> str | None:
        if not html:
            return None
        return _TAG_RE.sub(" ", html).strip() or None
