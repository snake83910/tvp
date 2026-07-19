"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { CheckoutSteps } from "@/components/CheckoutSteps";
import { useCart } from "@/components/CartProvider";
import { cartApi } from "@/lib/cart";
import {
  accountApi,
  useCurrentUser,
  type Address,
} from "@/lib/auth";
import { formatEuro } from "@/lib/money";

interface PriceChange {
  supplier_ref: string;
  label: string;
  old_ttc: number;
  new_ttc: number;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, refresh } = useCart();
  const { user, loading } = useCurrentUser();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [newAddress, setNewAddress] = useState({
    label: "Domicile",
    line1: "",
    line2: "",
    postal_code: "",
    city: "",
    country: "FR",
  });
  const [showNew, setShowNew] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);

  // Code promo : aperçu validé par l'API, re-vérifié au checkout
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{
    code: string;
    discount_ttc: number;
    description: string | null;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);

  async function applyPromo(e: React.FormEvent) {
    e.preventDefault();
    if (!promoInput.trim()) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const res = await cartApi.validatePromo(promoInput);
      if (res.valid && res.code) {
        setPromo({
          code: res.code,
          discount_ttc: res.discount_ttc,
          description: res.description,
        });
        setPromoInput("");
      } else {
        setPromoError(res.reason ?? "Code promo invalide");
      }
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setPromoBusy(false);
    }
  }

  // Redirection si pas connecté
  useEffect(() => {
    if (!loading && !user) router.push("/connexion?next=/checkout");
  }, [loading, user, router]);

  // Refresh panier + adresses
  useEffect(() => {
    if (!user) return;
    refresh();
    accountApi
      .listAddresses()
      .then((list) => {
        setAddresses(list);
        const def = list.find((a) => a.is_default) ?? list[0];
        if (def) setSelectedId(def.id);
        else setShowNew(true); // pas d'adresse -> on en saisit une
      })
      .catch((e) => {
        setError(
          e instanceof Error
            ? e.message
            : "Impossible de charger vos adresses",
        );
      });
  }, [user, refresh]);

  // Frais de port : renvoyés par l'API avec le panier (règle métier
  // « gratuit si toutes les lignes >= 2 » calculée côté serveur)
  const articlesTtc = cart?.total_ttc ?? 0;
  const shippingTtc = cart?.shipping_ttc ?? 0;
  const isFreeShipping = cart?.free_shipping ?? false;
  const discountTtc = promo?.discount_ttc ?? 0;
  const grandTotal = +(articlesTtc - discountTtc + shippingTtc).toFixed(2);

  async function handleSubmit() {
    setError(null);
    setPriceChanges([]);
    if (!acceptTerms) {
      setError("Vous devez accepter les CGV pour continuer.");
      return;
    }
    setBusy(true);
    try {
      let addressId = selectedId;
      if (showNew) {
        const created = await accountApi.addAddress({
          ...newAddress,
          is_default: addresses.length === 0,
        });
        addressId = created.id;
      }
      if (!addressId) {
        setError("Veuillez choisir ou saisir une adresse de livraison.");
        setBusy(false);
        return;
      }
      const res = await cartApi.checkout(
        addressId, true, "home", promo?.code ?? null,
      );
      if (res.price_changes.length > 0) {
        // Prix fournisseur modifiés : tableau avant/après explicite
        setPriceChanges(res.price_changes);
        await refresh();
        setBusy(false);
        return;
      }
      // Commande créée -> page de paiement
      router.push(`/paiement/${res.order_number}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Erreur lors de la commande",
      );
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-ink-muted">Chargement…</p>
        </main>
      </>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h1 className="font-display text-2xl font-black text-ink">
            Panier vide
          </h1>
          <Link
            href="/recherche"
            className="mt-6 inline-block rounded-full bg-signal px-6 py-3 font-bold text-white hover:bg-signal-dark"
          >
            Rechercher des pneus
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-4 font-display text-3xl font-black tracking-tightest text-ink">
          Finaliser ma commande
        </h1>
        <CheckoutSteps current={2} />

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {/* Adresse */}
            <Section title="1 · Adresse de livraison">
              {addresses.length > 0 && !showNew && (
                <div className="space-y-2">
                  {addresses.map((a) => (
                    <label
                      key={a.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${
                        selectedId === a.id
                          ? "border-signal bg-signal-light"
                          : "border-line hover:border-signal/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="addr"
                        checked={selectedId === a.id}
                        onChange={() => setSelectedId(a.id)}
                        className="mt-1 accent-signal"
                      />
                      <div>
                        <p className="font-semibold text-ink">
                          {a.label ?? "Adresse"}
                        </p>
                        <p className="text-sm text-ink-muted">
                          {a.line1}
                          {a.line2 ? `, ${a.line2}` : ""},{" "}
                          {a.postal_code} {a.city}
                        </p>
                      </div>
                    </label>
                  ))}
                  <button
                    onClick={() => setShowNew(true)}
                    className="text-sm font-semibold text-signal hover:underline"
                  >
                    + Ajouter une nouvelle adresse
                  </button>
                </div>
              )}
              {showNew && (
                <div className="space-y-3">
                  <Input
                    label="Adresse"
                    value={newAddress.line1}
                    onChange={(v) =>
                      setNewAddress({ ...newAddress, line1: v })
                    }
                  />
                  <Input
                    label="Complément (facultatif)"
                    value={newAddress.line2}
                    onChange={(v) =>
                      setNewAddress({ ...newAddress, line2: v })
                    }
                    required={false}
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      label="Code postal"
                      value={newAddress.postal_code}
                      onChange={(v) =>
                        setNewAddress({ ...newAddress, postal_code: v })
                      }
                    />
                    <div className="col-span-2">
                      <Input
                        label="Ville"
                        value={newAddress.city}
                        onChange={(v) =>
                          setNewAddress({ ...newAddress, city: v })
                        }
                      />
                    </div>
                  </div>
                  {addresses.length > 0 && (
                    <button
                      onClick={() => setShowNew(false)}
                      className="text-sm text-ink-muted hover:text-signal"
                    >
                      ← Utiliser une adresse existante
                    </button>
                  )}
                </div>
              )}
            </Section>

            {/* Livraison */}
            <Section title="2 · Mode de livraison">
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border-2 border-signal bg-signal-light p-4">
                  <div>
                    <p className="font-semibold text-ink">
                      Livraison à domicile
                    </p>
                    <p className="text-sm text-ink-muted">
                      {isFreeShipping
                        ? "Gratuite (toutes les références à ≥ 2 pneus)"
                        : `${formatEuro(cart.shipping_ht)} HT — gratuite si chaque référence est à 2 pneus minimum`}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-signal">
                    Sélectionné
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-line bg-paper-dim p-4 opacity-60">
                  <div>
                    <p className="font-semibold text-ink-soft">
                      Montage chez un garage partenaire
                    </p>
                    <p className="text-sm text-ink-muted">
                      Bientôt disponible
                    </p>
                  </div>
                </div>
              </div>
            </Section>

            {/* CGV */}
            <Section title="3 · Conditions générales">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-signal"
                />
                <span className="text-ink-soft">
                  J&apos;accepte les{" "}
                  <Link
                    href="/cgv"
                    target="_blank"
                    className="font-semibold text-signal hover:underline"
                  >
                    conditions générales de vente
                  </Link>{" "}
                  et reconnais avoir pris connaissance des informations
                  sur le droit de rétractation de 14 jours.
                </span>
              </label>
            </Section>
          </div>

          {/* Récap */}
          <aside className="h-fit space-y-4 rounded-2xl border border-line bg-paper p-6 shadow-card">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
              Récapitulatif
            </p>
            <div className="space-y-2 border-b border-line pb-4">
              {cart.items.map((it) => (
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
            {promo ? (
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
                  onClick={() => setPromo(null)}
                  className="text-xs text-ink-muted hover:text-signal"
                  title="Retirer le code"
                >
                  Retirer ✕
                </button>
              </div>
            ) : (
              <form onSubmit={applyPromo} className="flex gap-2">
                <input
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value.toUpperCase());
                    setPromoError(null);
                  }}
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
            )}
            {promoError && (
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
              onClick={handleSubmit}
              disabled={busy || !acceptTerms}
              className="w-full rounded-full bg-signal py-3 font-display font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark disabled:opacity-50"
            >
              {busy ? "Validation…" : "Procéder au paiement"}
            </button>
            <div className="space-y-1 text-center text-[11px] text-ink-muted">
              <p>🔒 Paiement sécurisé Société Générale (Sogecommerce)</p>
              <p>↩ Rétractation 14 jours · Garantie constructeur</p>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-paper p-6 shadow-card">
      <h2 className="mb-4 font-display text-lg font-bold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </label>
      <input
        required={required}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-ink outline-none transition focus:border-signal"
      />
    </div>
  );
}
