"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { CheckoutSteps } from "@/components/CheckoutSteps";
import { useCart } from "@/components/CartProvider";
import { AddressPicker } from "@/components/checkout/AddressPicker";
import { DeliveryModeSelector } from "@/components/checkout/DeliveryModeSelector";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { Section } from "@/components/checkout/fields";
import type { PriceChange } from "@/components/checkout/types";
import { cartApi } from "@/lib/cart";
import type { GarageNearby } from "@/lib/api";
import {
  accountApi,
  useCurrentUser,
  type Address,
} from "@/lib/auth";

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
  // Facturation : identique à la livraison par défaut (cas courant).
  // Décoché -> le client choisit/saisit une adresse distincte.
  const [sameBilling, setSameBilling] = useState(true);
  const [billingId, setBillingId] = useState<string>("");
  const [newBilling, setNewBilling] = useState({
    label: "Facturation",
    line1: "",
    line2: "",
    postal_code: "",
    city: "",
    country: "FR",
  });
  const [showNewBilling, setShowNewBilling] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<"home" | "partner_garage">("home");
  const [selectedGarage, setSelectedGarage] = useState<GarageNearby | null>(null);
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
        if (def) {
          setSelectedId(def.id);
          setBillingId(def.id);
        } else {
          // pas d'adresse -> on en saisit une
          setShowNew(true);
          setShowNewBilling(true);
        }
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

      // Facturation : null = identique à la livraison (le back recopie).
      let billingAddressId: string | null = null;
      if (!sameBilling) {
        if (showNewBilling) {
          const created = await accountApi.addAddress({
            ...newBilling,
            is_default: false,
          });
          billingAddressId = created.id;
        } else {
          billingAddressId = billingId;
        }
        if (!billingAddressId) {
          setError("Veuillez choisir ou saisir une adresse de facturation.");
          setBusy(false);
          return;
        }
      }

      if (deliveryMode === "partner_garage" && !selectedGarage) {
        setError("Veuillez sélectionner un garage partenaire pour le montage.");
        setBusy(false);
        return;
      }

      const res = await cartApi.checkout(
        addressId, true, deliveryMode, promo?.code ?? null, billingAddressId,
        deliveryMode === "partner_garage" ? selectedGarage?.id ?? null : null,
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

  // Les comptes partenaires (garages) ne passent pas commande comme un client.
  if (user.role === "garage") {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h1 className="font-display text-2xl font-black text-ink">
            Compte partenaire
          </h1>
          <p className="mt-3 text-ink-muted">
            Les comptes partenaires ne peuvent pas passer commande. Retrouvez
            vos commandes et votre page dans votre espace.
          </p>
          <Link
            href="/partenaire"
            className="mt-6 inline-block rounded-full bg-signal px-6 py-3 text-sm font-bold text-white hover:bg-signal-dark"
          >
            Aller à mon espace partenaire
          </Link>
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
              <AddressPicker
                radioName="addr"
                addresses={addresses}
                selectedId={selectedId}
                onSelect={setSelectedId}
                showNew={showNew}
                onShowNew={setShowNew}
                draft={newAddress}
                onDraft={setNewAddress}
              />

              {/* Facturation : repliée tant qu'elle est identique */}
              <div className="mt-6 border-t border-line pt-5">
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={sameBilling}
                    onChange={(e) => {
                      setSameBilling(e.target.checked);
                      // Pas d'adresse enregistrée : on ouvre la saisie
                      if (!e.target.checked && addresses.length === 0)
                        setShowNewBilling(true);
                    }}
                    className="h-5 w-5 accent-signal"
                  />
                  <span className="font-semibold text-ink-soft">
                    L&apos;adresse de facturation est identique
                  </span>
                </label>

                {!sameBilling && (
                  <div className="mt-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-muted">
                      Adresse de facturation
                    </p>
                    <AddressPicker
                      radioName="billing-addr"
                      addresses={addresses}
                      selectedId={billingId}
                      onSelect={setBillingId}
                      showNew={showNewBilling}
                      onShowNew={setShowNewBilling}
                      draft={newBilling}
                      onDraft={setNewBilling}
                    />
                  </div>
                )}
              </div>
            </Section>

            {/* Livraison */}
            <Section title="2 · Mode de livraison">
              <DeliveryModeSelector
                mode={deliveryMode}
                onSelectHome={() => { setDeliveryMode("home"); setSelectedGarage(null); }}
                onSelectPartner={() => setDeliveryMode("partner_garage")}
                shippingHt={cart.shipping_ht}
                isFreeShipping={isFreeShipping}
                selectedGarage={selectedGarage}
                onSelectGarage={setSelectedGarage}
              />
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
          <OrderSummary
            items={cart.items}
            promo={promo}
            promoInput={promoInput}
            promoError={promoError}
            promoBusy={promoBusy}
            onPromoInputChange={(v) => {
              setPromoInput(v);
              setPromoError(null);
            }}
            onApplyPromo={applyPromo}
            onRemovePromo={() => setPromo(null)}
            articlesTtc={articlesTtc}
            discountTtc={discountTtc}
            shippingTtc={shippingTtc}
            grandTotal={grandTotal}
            priceChanges={priceChanges}
            error={error}
            busy={busy}
            acceptTerms={acceptTerms}
            onSubmit={handleSubmit}
          />
        </div>
      </main>
    </>
  );
}
