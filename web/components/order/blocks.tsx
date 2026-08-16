import { formatEuro } from "@/lib/money";
import type { OrderDetail, AddressSnapshot } from "@/lib/auth";

/**
 * Blocs partagés entre la page commande du CLIENT et celle de l'ADMIN.
 *
 * Les deux écrans montrent la même commande mais ne font pas le même
 * métier : l'admin scanne un tableau dense, le client lit des cartes.
 * Fusionner les gabarits aurait produit un composant à embranchements
 * partout, pire que la duplication. Ce qui est mis en commun, c'est la
 * SUBSTANCE : quels champs, dans quel ordre, avec quels replis et quels
 * calculs.
 *
 * C'est là que les deux pages avaient dérivé, et sur des faits :
 *   — libellés de statut redéfinis en double, avec des textes différents
 *     pour un même état ;
 *   — le récapitulatif admin OMETTAIT la remise promo : sur une commande
 *     remisée, articles + livraison + TVA ne tombaient pas sur le total ;
 *   — le numéro de facture n'existait que côté admin, le suivi de colis
 *     que côté client.
 */

/** Numéro de facture lisible, ou null tant qu'elle n'est pas émise. */
export function invoiceLabel(order: {
  invoice_number: number | null;
  paid_at: string | null;
}): string | null {
  if (!order.invoice_number || !order.paid_at) return null;
  const year = new Date(order.paid_at).getFullYear();
  return `FAC-${year}-${String(order.invoice_number).padStart(6, "0")}`;
}

/** Référence de la facture d'avoir, série dédiée AV.
 *
 *  Le millésime vient de la date de remboursement, pas de celle de la
 *  commande : un remboursement de janvier sur une vente de décembre
 *  appartient au nouvel exercice. */
export function creditNoteLabel(order: {
  credit_note_number?: number | null;
  refunded_at?: string | null;
  created_at?: string | null;
}): string | null {
  if (!order.credit_note_number) return null;
  const base = order.refunded_at || order.created_at;
  const year = base ? new Date(base).getFullYear() : new Date().getFullYear();
  return `AV-${year}-${String(order.credit_note_number).padStart(6, "0")}`;
}

/** Date au format long français, ou null. */
function longDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** « Passée le … · Payée le … » — même phrase des deux côtés. */
export function OrderDates({ order }: { order: OrderDetail }) {
  const paid = longDate(order.paid_at);
  return (
    <p className="mt-1 text-sm text-ink-muted">
      Passée le {longDate(order.created_at)}
      {paid && <> · Payée le {paid}</>}
    </p>
  );
}

/** Adresse figée dans la commande.
 *
 *  `dense` : présentation en lignes libellé/valeur (admin) ; sinon bloc
 *  d'adresse classique (client). Les CHAMPS et leurs replis sont les
 *  mêmes dans les deux cas. */
export function AddressBlock({
  address,
  fallbackLabel,
  dense,
}: {
  address: AddressSnapshot;
  fallbackLabel: string;
  dense?: boolean;
}) {
  const street = [address.line1, address.line2].filter(Boolean).join(", ");
  const country = address.country ?? "FR";

  if (dense) {
    return (
      <>
        {address.label && <DenseRow label="Libellé" value={address.label} />}
        <DenseRow label="Adresse" value={street} />
        <DenseRow label="Ville" value={`${address.postal_code} ${address.city}`} />
        <DenseRow label="Pays" value={country} />
      </>
    );
  }
  return (
    <>
      <p className="text-sm font-semibold text-ink">
        {address.label ?? fallbackLabel}
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        {address.line1}
        {address.line2 && (
          <>
            <br />
            {address.line2}
          </>
        )}
        <br />
        {address.postal_code} {address.city}
        <br />
        {country}
      </p>
    </>
  );
}

/** Ligne libellé / valeur des écrans denses (admin). */
export function DenseRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

/** Lignes de la commande. Tableau pour l'admin, cartes pour le client —
 *  mêmes données, même arrondi. */
export function OrderItems({
  items,
  dense,
}: {
  items: OrderDetail["items"];
  dense?: boolean;
}) {
  if (dense) {
    return (
      <table className="w-full text-sm">
        <thead className="border-b border-line text-xs font-bold uppercase tracking-wider text-ink-muted">
          <tr>
            <th className="pb-2 text-left">Réf.</th>
            <th className="pb-2 text-left">Désignation</th>
            <th className="pb-2 text-center">Qté</th>
            <th className="pb-2 text-right">PU TTC</th>
            <th className="pb-2 text-right">Total TTC</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.supplier_ref} className="border-t border-line">
              <td className="py-2 pr-3 font-mono text-xs text-ink-muted">
                {it.supplier_ref}
              </td>
              <td className="py-2 pr-4 text-ink">{it.label}</td>
              <td className="py-2 text-center text-ink-soft">{it.quantity}</td>
              <td className="py-2 text-right text-ink-soft">
                {formatEuro(it.unit_price_ttc)}
              </td>
              <td className="py-2 text-right font-semibold text-ink">
                {formatEuro(it.line_total_ttc)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <div className="divide-y divide-line">
      {items.map((it) => (
        <div
          key={it.supplier_ref}
          className="flex items-start justify-between gap-4 px-6 py-4"
        >
          <div className="min-w-0">
            <p className="font-display font-bold text-ink">{it.label}</p>
            <p className="mt-1 text-sm text-ink-muted">
              Réf {it.supplier_ref} · {it.quantity} pneu
              {it.quantity > 1 ? "s" : ""} × {formatEuro(it.unit_price_ttc)}
            </p>
          </div>
          <p className="shrink-0 font-display font-black text-ink">
            {formatEuro(it.line_total_ttc)}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Récapitulatif des montants.
 *
 *  La ligne de remise n'est PAS optionnelle selon l'écran : la masquer
 *  côté admin, comme c'était le cas, rendait le total incohérent avec
 *  ses composantes dès qu'un code promo était appliqué. */
export function OrderTotals({
  order,
  dense,
}: {
  order: OrderDetail;
  dense?: boolean;
}) {
  const discount = order.discount_ttc ?? 0;
  return (
    <div className={dense ? "space-y-1 text-sm" : ""}>
      <Line label="Articles" value={formatEuro(order.articles_ttc)} />
      {/* Le HT n'intéresse que l'exploitation. L'ancien récapitulatif
          admin l'affichait À LA PLACE du TTC, en le mêlant à des lignes
          TTC : la colonne ne tombait alors pas sur le total. Il est
          conservé, mais comme précision. */}
      {dense && (
        <div className="flex justify-between text-xs text-ink-muted">
          <span>dont articles HT</span>
          <span>{formatEuro(order.articles_ht)}</span>
        </div>
      )}
      {discount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-ok">
            Remise{order.promo_code ? ` (${order.promo_code})` : ""}
          </span>
          <span className="font-semibold text-ok">−{formatEuro(discount)}</span>
        </div>
      )}
      <Line
        label="Livraison"
        value={order.shipping_ttc === 0 ? "Offerte" : formatEuro(order.shipping_ttc)}
      />
      <div className="mt-2 flex justify-between border-t border-line pt-3 text-xs text-ink-muted">
        <span>dont TVA</span>
        <span>{formatEuro(order.total_vat)}</span>
      </div>
      <div
        className={`mt-3 flex justify-between border-t border-line pt-3 font-display font-black text-ink ${
          dense ? "text-base" : "text-xl"
        }`}
      >
        <span>Total TTC</span>
        <span>{formatEuro(order.total_ttc)}</span>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

/** Suivi du colis. N'existait que côté client : l'admin saisissait le
 *  transporteur sans jamais le revoir ensuite. */
export function TrackingBlock({ order }: { order: OrderDetail }) {
  return (
    <>
      {order.carrier && (
        <p className="text-sm text-ink-soft">
          Transporteur :{" "}
          <span className="font-semibold text-ink">{order.carrier}</span>
        </p>
      )}
      {order.tracking_number && (
        <p className="mt-1 text-sm text-ink-soft">
          N° de suivi :{" "}
          <span className="font-mono font-semibold text-ink">
            {order.tracking_number}
          </span>
        </p>
      )}
      {order.tracking_url && (
        <a
          href={order.tracking_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-signal px-4 py-2 text-sm font-bold text-white transition hover:bg-signal-dark"
        >
          Suivre le colis →
        </a>
      )}
      {!order.carrier && !order.tracking_number && !order.tracking_url && (
        <p className="text-sm text-ink-muted">
          Informations de suivi bientôt disponibles.
        </p>
      )}
    </>
  );
}
