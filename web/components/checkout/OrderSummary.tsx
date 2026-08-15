import type { CartItem } from "@/lib/cart";
import { formatEuro } from "@/lib/money";
import type { PriceChange } from "./types";

interface Promo {
  code: string;
  discount_ttc: number;
  description: string | null;
}

/** Colonne récapitulative du checkout : lignes du panier, code promo,
 *  totaux, écarts de prix fournisseur et bouton de validation. Purement
 *  présentationnel — toute la logique reste dans la page. */
export function OrderSummary({
  items,
  promo,
  promoInput,
  promoError,
  promoBusy,
  onPromoInputChange,
  onApplyPromo,
  onRemovePromo,
  articlesTtc,
  discountTtc,
  shippingTtc,
  grandTotal,
  priceChanges,
  error,
  busy,
  acceptTerms,
  onSubmit,
  showPromo = true,
  submitLabel,
}: {
  items: CartItem[];
  promo: Promo | null;
  promoInput: string;
  promoError: string | null;
  promoBusy: boolean;
  onPromoInputChange: (v: string) => void;
  onApplyPromo: (e: React.FormEvent) => void;
  onRemovePromo: () => void;
  articlesTtc: number;
  discountTtc: number;
  shippingTtc: number;
  grandTotal: number;
  priceChanges: PriceChange[];
  error: string | null;
  busy: boolean;
  acceptTerms: boolean;
  onSubmit: () => void;
  // Masqué pour un visiteur non connecté : l'aperçu de remise
  // (/cart/promo/validate) exige une session.
  showPromo?: boolean;
  submitLabel?: string;
}) {
  return (
    <aside className="h-fit space-y-4 rounded-2xl border border-line bg-paper p-6 shadow-card">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
        Récapitulatif
      </p>
      <div className="space-y-2 border-b border-line pb-4">
        {items.map((it) => (
          <div key={it.id} className="flex justify-between text-sm">
            <span className="text-ink-soft">
              {it.label}{" "}
              <span className="text-ink-muted">
                × {it.quantity}
              </span>
            </span>
            <span className="font-semibold text-ink">
              {formatEuro(it.price_ttc * it.quantity)}
            </span>
          </div>
        ))}
      </div>
      {/* Code promo */}
      {showPromo && (promo ? (
        <div className="flex items-center justify-between rounded-lg border border-ok/40 bg-ok/5 px-3 py-2 text-sm">
          <span className="font-semibold text-ok">
            🏷 {promo.code}
            {promo.description && (
              <span className="block text-xs font-normal">
                {promo.description}
              </span>
            )}
          </span>
          <button
            onClick={onRemovePromo}
            className="text-xs text-ink-muted hover:text-signal"
            title="Retirer le code"
          >
            Retirer ✕
          </button>
        </div>
      ) : (
        <form onSubmit={onApplyPromo} className="flex gap-2">
          <input
            value={promoInput}
            onChange={(e) => onPromoInputChange(e.target.value.toUpperCase())}
            placeholder="Code promo"
            className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 font-mono text-sm uppercase outline-none focus:border-signal"
          />
          <button
            type="submit"
            disabled={promoBusy || !promoInput.trim()}
            className="rounded-lg border border-line px-4 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal disabled:opacity-50"
          >
            {promoBusy ? "…" : "Appliquer"}
          </button>
        </form>
      ))}
      {showPromo && promoError && (
        <p className="rounded-lg bg-signal-light px-3 py-2 text-xs text-signal-dark">
          {promoError}
        </p>
      )}

      <div className="flex justify-between text-sm">
        <span className="text-ink-soft">Sous-total</span>
        <span className="font-semibold text-ink">
          {formatEuro(articlesTtc)}
        </span>
      </div>
      {promo && (
        <div className="flex justify-between text-sm">
          <span className="text-ok">Remise ({promo.code})</span>
          <span className="font-semibold text-ok">
            −{formatEuro(discountTtc)}
          </span>
        </div>
      )}
      <div className="flex justify-between text-sm">
        <span className="text-ink-soft">Livraison</span>
        <span className="font-semibold text-ink">
          {shippingTtc === 0 ? "Offerte" : formatEuro(shippingTtc)}
        </span>
      </div>
      <div className="flex justify-between border-t border-line pt-4 font-display text-xl font-black text-ink">
        <span>Total TTC</span>
        <span>{formatEuro(grandTotal)}</span>
      </div>

      {priceChanges.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="mb-2 text-sm font-bold text-amber-800">
            Le prix fournisseur de certains articles a changé :
          </p>
          <table className="w-full text-xs">
            <tbody>
              {priceChanges.map((c) => (
                <tr key={c.supplier_ref}>
                  <td className="truncate py-1 pr-2 text-amber-900" title={c.label}>
                    {c.label}
                  </td>
                  <td className="whitespace-nowrap py-1 text-right">
                    <span className="text-amber-700 line-through">
                      {formatEuro(c.old_ttc)}
                    </span>{" "}
                    <span
                      className={`font-bold ${
                        c.new_ttc === 0
                          ? "text-signal"
                          : c.new_ttc > c.old_ttc
                            ? "text-signal"
                            : "text-ok"
                      }`}
                    >
                      {c.new_ttc === 0
                        ? "indisponible"
                        : formatEuro(c.new_ttc)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-amber-800">
            Votre panier a été mis à jour — vérifiez les montants
            puis validez à nouveau.
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-signal-light px-3 py-2 text-sm font-medium text-signal-dark">
          {error}
        </p>
      )}

      <button
        onClick={onSubmit}
        disabled={busy || !acceptTerms}
        className="w-full rounded-full bg-signal py-3 font-display font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark disabled:opacity-50"
      >
        {busy ? "Validation…" : (submitLabel ?? "Procéder au paiement")}
      </button>
      <div className="space-y-1 text-center text-[11px] text-ink-muted">
        <p>🔒 Paiement sécurisé Société Générale (Sogecommerce)</p>
        <p>↩ Rétractation 14 jours · Garantie constructeur</p>
      </div>
    </aside>
  );
}
