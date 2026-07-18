"""
Génération de factures PDF avec fpdf2.

Appelé depuis :
  - /me/orders/{n}/invoice  (client, vérifie ownership)
  - /admin/orders/{n}/invoice  (admin, tous)

Note : police Helvetica = Latin-1 uniquement. Aucun caractère hors
de cet ensemble (euro, tirets longs, ellipses, emojis...).
"""
from __future__ import annotations

from fpdf import FPDF

from app.models.order import Order, OrderStatus
from app.models.user import User

_COMPANY_NAME    = "Tous Vos Pneus"
_COMPANY_EMAIL   = "serviceclient@tousvospneus.com"
_COMPANY_WEBSITE = "www.tousvospneus.com"

_BILLED_STATUSES = {
    OrderStatus.paid,
    OrderStatus.sent_to_supplier,
    OrderStatus.shipped,
    OrderStatus.delivered,
    OrderStatus.refunded,
}

_COL_W = (15, 85, 18, 18, 22, 26)


class _InvoicePDF(FPDF):
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


def generate_invoice_pdf(order: Order, user: User) -> bytes:
    is_proforma = order.status not in _BILLED_STATUSES

    pdf = _InvoicePDF()
    pdf.add_page()

    # ── En-tête : nom société + titre ────────────────────────────
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(100, 8, _COMPANY_NAME.upper(), ln=False)

    doc_title = "FACTURE PRO FORMA" if is_proforma else "FACTURE"
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 8, doc_title, align="R", ln=True)
    pdf.ln(2)

    ref_date = order.paid_at or order.created_at
    if order.invoice_number:
        invoice_ref = f"FAC-{ref_date.year}-{order.invoice_number:06d}"
    else:
        invoice_ref = f"PRO-{order.order_number}"

    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(90, 90, 90)
    pdf.cell(100, 4, _COMPANY_EMAIL, ln=False)
    pdf.cell(100, 4, f"N  {invoice_ref}", ln=False)
    pdf.ln(4)

    pdf.cell(100, 4, _COMPANY_WEBSITE, ln=False)
    pdf.cell(100, 4, f"Date : {ref_date.strftime('%d/%m/%Y')}", ln=True)
    pdf.ln(8)

    # ── Séparateur rouge ─────────────────────────────────────────
    pdf.set_draw_color(220, 38, 38)
    pdf.set_line_width(0.5)
    pdf.line(18, pdf.get_y(), 192, pdf.get_y())
    pdf.ln(6)

    # ── Bloc client ───────────────────────────────────────────────
    addr = order.shipping_address
    full_name = " ".join(filter(None, [user.first_name, user.last_name]))

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 5, "FACTURE A", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(50, 50, 50)
    if full_name:
        pdf.cell(0, 4, full_name, ln=True)
    pdf.cell(0, 4, user.email, ln=True)
    if addr.get("line1"):
        pdf.cell(0, 4, addr["line1"], ln=True)
    if addr.get("line2"):
        pdf.cell(0, 4, addr["line2"], ln=True)
    if addr.get("postal_code") or addr.get("city"):
        pdf.cell(0, 4, f"{addr.get('postal_code', '')} {addr.get('city', '')}".strip(), ln=True)
    pdf.cell(0, 4, addr.get("country", "FR"), ln=True)

    if is_proforma:
        pdf.ln(4)
        pdf.set_font("Helvetica", "I", 8)
        pdf.set_text_color(180, 90, 0)
        pdf.cell(0, 5, "Document pro forma - ne constitue pas une facture definitive.", ln=True)

    pdf.ln(8)

    # ── Tableau articles — en-tête ────────────────────────────────
    headers = ["Ref.", "Designation", "Qte", "PU HT", "TVA", "Total TTC"]
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
    shipping_ttc = (order.shipping_ht_cents + order.shipping_vat_cents) / 100

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

    # ── Pied légal ────────────────────────────────────────────────
    pdf.ln(10)
    pdf.set_draw_color(210, 210, 210)
    pdf.set_line_width(0.3)
    pdf.line(18, pdf.get_y(), 192, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(130, 130, 130)
    paid_label = (
        f"Payee le {order.paid_at.strftime('%d/%m/%Y')}"
        if order.paid_at else "En attente de paiement"
    )
    livraison = "domicile" if order.delivery_mode == "home" else order.delivery_mode
    pdf.cell(0, 4, f"Statut : {paid_label}  -  Livraison : {livraison}", ln=True)
    pdf.cell(0, 4, "TVA non applicable, art. 293 B du CGI - si applicable.", ln=True)

    return bytes(pdf.output())
