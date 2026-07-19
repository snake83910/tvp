"""
Génération de factures PDF avec fpdf2.

Appelé depuis :
  - /me/orders/{n}/invoice  (client, vérifie ownership)
  - /admin/orders/{n}/invoice  (admin, tous)

Note : police Helvetica = Latin-1. Les accents français passent sans
problème ; en revanche PAS de symbole euro, de tiret long, d'ellipse
ni d'emoji — d'où « EUR » écrit en toutes lettres.
"""
from __future__ import annotations

from fpdf import FPDF

from app.core.config import settings
from app.models.order import Order, OrderStatus
from app.models.user import User

_COMPANY_NAME    = "Tous Vos Pneus"
_COMPANY_EMAIL   = "serviceclient@tousvospneus.com"
_COMPANY_WEBSITE = "www.tousvospneus.com"

# Charte : rouge de la marque, encre, gris de texte secondaire
_RED   = (220, 38, 38)
_INK   = (23, 24, 26)
_GREY  = (122, 122, 114)
_LINE  = (222, 222, 218)

_BILLED_STATUSES = {
    OrderStatus.paid,
    OrderStatus.sent_to_supplier,
    OrderStatus.shipped,
    OrderStatus.delivered,
    OrderStatus.refunded,
}

# Réf. / Désignation / Qté / PU HT / TVA / Total TTC.
# La somme DOIT valoir 174 mm (210 - 2 x 18 de marge), sinon le tableau
# déborde la marge droite et ne s'aligne plus sur le bloc des totaux.
_COL_W = (22, 72, 12, 22, 14, 32)


# Caractères courants hors latin-1, avec leur équivalent lisible. Le
# symbole euro est le piège nº1 : il n'est PAS dans latin-1 et fpdf lève
# une exception plutôt que de l'ignorer. Une facture ne doit jamais
# échouer sur une coquille de saisie ou un libellé fournisseur exotique.
_SUBSTITUTIONS = {
    # " EUR" et non "EUR" : sans l'espace, « 500€ » donnerait « 500EUR ».
    # Le doublon d'espace de « 500 € » est retiré juste après.
    "€": " EUR",
    "—": "-",     # —
    "–": "-",     # –
    "’": "'",     # ’
    "‘": "'",     # ‘
    "“": '"',     # “
    "”": '"',     # ”
    "…": "...",   # …
    " ": " ",     # espace insécable
    "•": "-",     # •
}


def _latin1(text: str) -> str:
    """Rend un texte imprimable par Helvetica (latin-1).

    Les accents français passent tels quels ; seuls les caractères hors
    du jeu sont remplacés. Ce qui n'a pas d'équivalent devient « ? » :
    visible et corrigeable, plutôt qu'une facture qui part en erreur 500.
    """
    for bad, good in _SUBSTITUTIONS.items():
        text = text.replace(bad, good)
    text = text.replace("  EUR", " EUR")
    return text.encode("latin-1", "replace").decode("latin-1")


def _clean(args: tuple, kwargs: dict, pos: int) -> tuple[tuple, dict]:
    """Assainit l'argument texte, qu'il soit positionnel ou nommé."""
    if len(args) > pos and isinstance(args[pos], str):
        args = args[:pos] + (_latin1(args[pos]),) + args[pos + 1:]
    for key in ("text", "txt"):
        if isinstance(kwargs.get(key), str):
            kwargs[key] = _latin1(kwargs[key])
    return args, kwargs


class _InvoicePDF(FPDF):
    # Point de passage unique : tout texte écrit dans la facture est
    # assaini ici. Le faire au cas par cas se serait oublié un jour.
    def cell(self, *args, **kwargs):          # type: ignore[override]
        args, kwargs = _clean(args, kwargs, 2)
        return super().cell(*args, **kwargs)

    def multi_cell(self, *args, **kwargs):    # type: ignore[override]
        args, kwargs = _clean(args, kwargs, 2)
        return super().multi_cell(*args, **kwargs)

    def __init__(self) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_margins(18, 18, 18)
        self.set_auto_page_break(auto=True, margin=20)

    def header(self) -> None:
        self.set_fill_color(220, 38, 38)
        self.rect(0, 0, 210, 8, "F")
        self.ln(12)

    def footer(self) -> None:
        self.set_y(-14)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(140, 140, 140)
        self.cell(
            0, 5,
            f"{_COMPANY_NAME} - {_COMPANY_EMAIL} - {_COMPANY_WEBSITE}",
            align="C",
        )
        self.ln(4)
        self.cell(0, 4, f"Page {self.page_no()}", align="C")


def _eur(amount: float) -> str:
    """Formate un montant sans le symbole euro (non supporté en Latin-1)."""
    return f"{amount:.2f} EUR"


def _truncate(text: str, n: int) -> str:
    return text[:n] + "..." if len(text) > n else text


def _draw_logo(pdf: FPDF, x: float, y: float) -> float:
    """Marque TOUSVOSPNEUS.COM en vectoriel : cercles concentriques
    (pneu) + typo, repris de l'en-tête du site. Vectoriel plutôt
    qu'une image : net à toutes les résolutions, aucun asset à
    embarquer et rien à charger au moment de générer la facture.

    Renvoie l'ordonnée du bas de la marque.
    """
    d = 9.0                      # diamètre du cercle extérieur
    # ATTENTION : depuis fpdf2 2.8.1, circle() prend le CENTRE en x, y
    # (le docstring de la lib décrit encore l'ancien coin haut-gauche).
    cx, cy = x + d / 2, y + d / 2

    pdf.set_line_width(0.7)
    pdf.set_draw_color(*_INK)
    pdf.circle(cx, cy, d / 2, style="D")

    pdf.set_line_width(0.6)
    pdf.set_draw_color(*_RED)
    pdf.circle(cx, cy, d / 2 - 1.9, style="D")

    pdf.set_fill_color(*_RED)
    pdf.circle(cx, cy, 0.8, style="F")

    # Typo : "TOUSVOSPNEUS" en encre, ".COM" en rouge
    pdf.set_font("Helvetica", "B", 15)
    pdf.set_xy(x + d + 2.5, y + 1.2)
    pdf.set_text_color(*_INK)
    pdf.cell(pdf.get_string_width("TOUSVOSPNEUS"), 6, "TOUSVOSPNEUS")
    pdf.set_text_color(*_RED)
    pdf.cell(pdf.get_string_width(".COM"), 6, ".COM")

    return y + d


def _issuer_lines() -> list[str]:
    """Identité légale de l'émetteur, d'après la configuration.

    Les identifiants (SIRET, RCS, TVA intracom.) ne sont JAMAIS
    inventés : si la variable d'environnement est vide, la ligne est
    simplement omise. Une facture avec un faux SIRET serait un faux
    document — mieux vaut une mention manquante et visible.
    """
    s = settings
    # .strip() : « COMPANY_CAPITAL= 500 EUR » dans un .env garde l'espace
    # de tête selon le parseur, ce qui décalerait la ligne à l'impression.
    def v(raw: str) -> str:
        return (raw or "").strip()

    lines = [v(s.company_legal_name) or _COMPANY_NAME]
    if v(s.company_capital):
        lines.append(f"SAS au capital de {v(s.company_capital)}")
    if v(s.company_address):
        lines.append(v(s.company_address))
    if v(s.company_city):
        lines.append(v(s.company_city))
    if v(s.company_siret):
        lines.append(f"SIRET {v(s.company_siret)}")
    if v(s.company_rcs):
        lines.append(f"RCS {v(s.company_rcs)}")
    if v(s.company_vat_number):
        lines.append(f"TVA intracom. {v(s.company_vat_number)}")
    lines.append(_COMPANY_EMAIL)
    return lines


def _address_lines(addr: dict) -> list[str]:
    """Lignes affichables d'un snapshot d'adresse, vides écartées."""
    city = f"{addr.get('postal_code', '')} {addr.get('city', '')}".strip()
    lines = [addr.get("line1"), addr.get("line2"), city,
             addr.get("country", "FR")]
    return [ligne for ligne in lines if ligne]


_BLOCK_W = 56.0   # 3 colonnes de 56 mm dans les 174 mm utiles


def _address_block(
    pdf: FPDF, x: float, y: float, title: str, lines: list[str]
) -> None:
    """Écrit un bloc adresse titré en colonne, à position absolue."""
    pdf.set_xy(x, y)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(*_GREY)
    pdf.cell(_BLOCK_W, 5, title.upper(), ln=True)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*_INK)
    for line in lines:
        pdf.set_x(x)
        pdf.cell(_BLOCK_W, 4, _truncate(line, 36), ln=True)


def generate_invoice_pdf(order: Order, user: User) -> bytes:
    is_proforma = order.status not in _BILLED_STATUSES

    pdf = _InvoicePDF()
    pdf.add_page()

    # ── En-tête : marque à gauche, titre + références à droite ────
    y_top = pdf.get_y()
    logo_bottom = _draw_logo(pdf, 18, y_top)

    doc_title = "FACTURE PRO FORMA" if is_proforma else "FACTURE"
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(*_INK)
    pdf.set_xy(110, y_top)
    pdf.cell(82, 9, doc_title, align="R", ln=True)

    ref_date = order.paid_at or order.created_at
    if order.invoice_number:
        invoice_ref = f"FAC-{ref_date.year}-{order.invoice_number:06d}"
    else:
        invoice_ref = f"PRO-{order.order_number}"

    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*_GREY)
    for label, value in [
        ("N°", invoice_ref),
        ("Date", ref_date.strftime("%d/%m/%Y")),
        ("Commande", order.order_number),
    ]:
        pdf.set_x(110)
        pdf.cell(82, 4, f"{label} : {value}", align="R", ln=True)

    pdf.set_y(max(logo_bottom, pdf.get_y()) + 5)

    # ── Séparateur rouge ─────────────────────────────────────────
    pdf.set_draw_color(*_RED)
    pdf.set_line_width(0.5)
    pdf.line(18, pdf.get_y(), 192, pdf.get_y())
    pdf.ln(6)

    # ── Blocs adresses, en colonnes ───────────────────────────────
    # Émetteur à gauche (mentions légales), client à droite. La
    # facturation fait foi pour « FACTURÉ À » ; la livraison n'apparaît
    # en 3e colonne que si le client a dissocié les deux.
    shipping = order.shipping_address or {}
    billing = order.billing_address or shipping
    full_name = " ".join(filter(None, [user.first_name, user.last_name]))

    issuer_lines = _issuer_lines()
    billing_lines = [
        *filter(None, [full_name, user.email]), *_address_lines(billing)
    ]
    shipping_lines = (
        _address_lines(shipping) if billing != shipping else []
    )

    y0 = pdf.get_y()
    _address_block(pdf, 18, y0, "ÉMETTEUR", issuer_lines)
    _address_block(pdf, 76, y0, "FACTURÉ À", billing_lines)
    if shipping_lines:
        _address_block(pdf, 134, y0, "LIVRÉ À", shipping_lines)
    tallest = max(len(issuer_lines), len(billing_lines), len(shipping_lines))
    pdf.set_y(y0 + 5 + 4 * tallest)

    if is_proforma:
        pdf.ln(3)
        pdf.set_font("Helvetica", "I", 8)
        pdf.set_text_color(180, 90, 0)
        pdf.cell(
            0, 5,
            "Document pro forma : ne constitue pas une facture définitive.",
            ln=True,
        )

    pdf.ln(8)

    # ── Tableau articles — en-tête ────────────────────────────────
    headers = ["Réf.", "Désignation", "Qté", "PU HT", "TVA", "Total TTC"]
    pdf.set_fill_color(245, 245, 245)
    pdf.set_text_color(30, 30, 30)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_line_width(0.3)
    pdf.set_draw_color(210, 210, 210)

    for i, h in enumerate(headers):
        align = "R" if i >= 2 else "L"
        pdf.cell(_COL_W[i], 7, h, border=1, fill=True, align=align)
    pdf.ln()

    # ── Tableau articles — lignes ─────────────────────────────────
    pdf.set_font("Helvetica", "", 8)
    fill = False

    for it in order.items:
        vat_mult = 1 + it.vat_rate / 100
        unit_ht  = it.unit_price_ht_cents / 100
        line_ttc = unit_ht * vat_mult * it.quantity

        pdf.set_fill_color(250, 250, 250) if fill else pdf.set_fill_color(255, 255, 255)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(_COL_W[0], 6, _truncate(it.supplier_ref, 12),      border=1, fill=fill, align="L")
        pdf.cell(_COL_W[1], 6, _truncate(it.label_snapshot, 47),    border=1, fill=fill, align="L")
        pdf.cell(_COL_W[2], 6, str(it.quantity),                     border=1, fill=fill, align="R")
        pdf.cell(_COL_W[3], 6, _eur(unit_ht),                        border=1, fill=fill, align="R")
        pdf.cell(_COL_W[4], 6, f"{it.vat_rate:.0f}%",               border=1, fill=fill, align="R")
        pdf.cell(_COL_W[5], 6, _eur(line_ttc),                       border=1, fill=fill, align="R")
        pdf.ln()
        fill = not fill

    pdf.ln(4)

    # ── Totaux ───────────────────────────────────────────────────
    x_label  = 120
    col_lbl  = 52
    col_val  = 20

    def total_row(label: str, value: str, bold: bool = False) -> None:
        pdf.set_x(x_label)
        pdf.set_font("Helvetica", "B" if bold else "", 9)
        pdf.set_text_color(50, 50, 50)
        pdf.cell(col_lbl, 6, label, align="R")
        pdf.cell(col_val, 6, value, align="R", ln=True)

    articles_ht  = sum(it.unit_price_ht_cents * it.quantity for it in order.items) / 100
    tva          = order.total_vat_cents / 100
    shipping_ht  = order.shipping_ht_cents / 100

    total_row("Total articles HT :", _eur(articles_ht))
    if getattr(order, "discount_ttc_cents", 0):
        code = order.promo_code or "PROMO"
        total_row(
            f"Remise ({code}) TTC :",
            f"-{_eur(order.discount_ttc_cents / 100)}",
        )
    if shipping_ht > 0:
        total_row("Livraison HT :",     _eur(shipping_ht))
    else:
        total_row("Livraison :",        "Offerte")
    total_row("TVA :",                  _eur(tva))

    y = pdf.get_y()
    pdf.set_draw_color(220, 38, 38)
    pdf.line(x_label, y, 192, y)
    pdf.ln(2)

    pdf.set_fill_color(220, 38, 38)
    pdf.set_text_color(255, 255, 255)
    pdf.set_x(x_label)
    pdf.set_font("Helvetica", "B", 10)
    total_label = f"TOTAL TTC   {_eur(order.total_ttc_cents / 100)}"
    pdf.cell(col_lbl + col_val, 8, total_label, align="R", fill=True, ln=True)

    # ── Règlement ─────────────────────────────────────────────────
    pdf.ln(10)
    pdf.set_draw_color(*_LINE)
    pdf.set_line_width(0.3)
    pdf.line(18, pdf.get_y(), 192, pdf.get_y())
    pdf.ln(4)

    if order.paid_at:
        reglement = (
            f"Payée le {order.paid_at.strftime('%d/%m/%Y')} "
            "par carte bancaire."
        )
    else:
        reglement = "En attente de paiement. Facture payable à réception."
    livraison = (
        "domicile" if order.delivery_mode == "home" else order.delivery_mode
    )

    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*_INK)
    pdf.cell(0, 4, "Règlement", ln=True)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*_GREY)
    pdf.cell(0, 4, f"{reglement}  Livraison : {livraison}.", ln=True)

    # ── Mentions légales ──────────────────────────────────────────
    # La mention « TVA non applicable, art. 293 B du CGI » a été retirée :
    # elle vise la franchise en base, incompatible avec une SAS
    # assujettie qui facture de la TVA (elle est d'ailleurs détaillée
    # ligne à ligne ci-dessus). L'y laisser était contradictoire.
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 6.5)
    pdf.set_text_color(*_GREY)
    for mention in [
        "Pénalités de retard : 3 fois le taux d'intérêt légal en vigueur. "
        "Indemnité forfaitaire pour frais de recouvrement : 40 EUR "
        "(art. L441-10 et D441-5 du code de commerce). Pas d'escompte "
        "pour paiement anticipé.",
        "Droit de rétractation de 14 jours à compter de la réception "
        "(art. L221-18 du code de la consommation), hors produits "
        "montés ou personnalisés.",
    ]:
        pdf.multi_cell(174, 3, mention, align="L")
        pdf.ln(0.5)

    return bytes(pdf.output())
