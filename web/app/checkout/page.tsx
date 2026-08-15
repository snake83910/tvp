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
import { Input, Section } from "@/components/checkout/fields";
import type { PriceChange } from "@/components/checkout/types";
import { cartApi, type AddressPayload } from "@/lib/cart";
import type { GarageNearby } from "@/lib/api";
import { ErrorCode, errorCode, errorMessage } from "@/lib/errors";
import {
  accountApi,
  saveTokens,
  useCurrentUser,
  type Address,
} from "@/lib/auth";

/**
 * Tunnel de commande — UNIQUE, avec ou sans compte.
 *
 * Il a longtemps existé en deux exemplaires : /checkout pour les clients
 * connectés, /checkout/invite pour les autres. La justification d'origine
 * — « le connecté travaille avec des adresses enregistrées, l'invité
 * saisit la sienne » — ne tenait déjà plus : AddressPicker sait faire les
 * deux, et c'est le MÊME composant qui rendait le formulaire de saisie
 * dans les deux pages.
 *
 * Ce qui divergeait, en revanche, était tout le reste : le mode de
 * livraison, le choix du garage et la prise de rendez-vous ont dû être
 * ajoutés deux fois ; le code promo et l'adresse de facturation distincte
 * n'existaient que côté connecté, privant de fait la majorité des clients
 * (la commande sans compte est le chemin principal) d'une fonctionnalité
 * que le backend accepte pourtant.
 *
 * Une seule page, donc. La seule vraie différence tient en deux blocs :
 * l'invité saisit son identité, le connecté choisit parmi ses adresses.
 */
export default function CheckoutPage() {
  const router = useRouter();
  const { cart, refresh } = useCart();
  const { user, loading } = useCurrentUser();
  const isGuest = !loading && !user;

  // Identité — invité uniquement (le connecté la tient de son compte).
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [accountExists, setAccountExists] = useState(false);

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
  // Créneau de montage choisi (ISO local du garage). Null = pas de RDV.
  const [mountingAt, setMountingAt] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);

  // Code promo : aperçu validé par l'API, re-vérifié au checkout.
  // Réservé aux connectés — /cart/promo/validate exige une session.
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
      setPromoError(errorMessage(err));
    } finally {
      setPromoBusy(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Carnet d'adresses : connectés seulement. Un invité n'en a pas, et
  // l'appel partirait sans jeton.
  useEffect(() => {
    if (!user) return;
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
      .catch((e) => setError(errorMessage(e, "Impossible de charger vos adresses")));
  }, [user]);

  // Frais de port : renvoyés par l'API avec le panier (règle métier
  // « gratuit si toutes les lignes >= 2 » calculée côté serveur)
  const articlesTtc = cart?.total_ttc ?? 0;
  const shippingTtc = cart?.shipping_ttc ?? 0;
  const isFreeShipping = cart?.free_shipping ?? false;
  const discountTtc = promo?.discount_ttc ?? 0;
  const grandTotal = +(articlesTtc - discountTtc + shippingTtc).toFixed(2);

  /** Adresse saisie -> charge utile API. */
  function draftToPayload(d: typeof newAddress): AddressPayload {
    return {
      line1: d.line1.trim(),
      line2: d.line2.trim() || null,
      postal_code: d.postal_code.trim(),
      city: d.city.trim(),
      country: d.country,
      label: d.label,
    };
  }

  /** Champs obligatoires de l'invité. Le tunnel n'ayant pas de <form>
   *  (un formulaire imbriqué casserait le sélecteur de garage), la
   *  validation HTML native ne s'applique pas : on la fait ici. */
  function missingGuestField(): string | null {
    if (!email.includes("@")) return "Saisissez une adresse email valide.";
    if (!firstName.trim() || !lastName.trim()) return "Indiquez vos nom et prénom.";
    if (!newAddress.line1.trim()) return "Indiquez votre adresse de livraison.";
    if (!newAddress.postal_code.trim() || !newAddress.city.trim())
      return "Indiquez votre code postal et votre ville.";
    if (!sameBilling && !newBilling.line1.trim())
      return "Indiquez votre adresse de facturation.";
    return null;
  }

  async function handleSubmit() {
    setError(null);
    setAccountExists(false);
    setPriceChanges([]);
    if (!acceptTerms) {
      setError("Vous devez accepter les conditions générales de vente.");
      return;
    }
    if (deliveryMode === "partner_garage" && !selectedGarage) {
      setError("Veuillez sélectionner un garage partenaire pour le montage.");
      return;
    }
    const garageId = deliveryMode === "partner_garage" ? selectedGarage?.id ?? null : null;
    const slot = deliveryMode === "partner_garage" ? mountingAt : null;

    if (isGuest) {
      const manquant = missingGuestField();
      if (manquant) {
        setError(manquant);
        return;
      }
      setBusy(true);
      try {
        const res = await cartApi.checkoutGuest({
          email,
          first_name: firstName,
          last_name: lastName,
          phone,
          shipping: draftToPayload(newAddress),
          billing: sameBilling ? null : draftToPayload(newBilling),
          delivery_mode: deliveryMode,
          garage_id: garageId,
          mounting_at: slot,
          accept_terms: true,
        });
        // Les jetons AVANT toute navigation : la page de paiement appelle
        // /payment/init, qui exige une session. Sans cet enregistrement,
        // le client arriverait sur un écran qui le rejette alors que sa
        // commande vient d'être créée.
        if (res.access_token && res.refresh_token) {
          saveTokens(res.access_token, res.refresh_token);
        }
        if (res.price_changes.length > 0) {
          setPriceChanges(res.price_changes);
          await refresh();
          setBusy(false);
          return;
        }
        if (res.order_number) router.push(`/paiement/${res.order_number}`);
      } catch (err) {
        setError(errorMessage(err, "Commande impossible"));
        // Email déjà enregistré : on ouvre le chemin de la connexion
        // plutôt que de laisser le client dans une impasse.
        if (errorCode(err) === ErrorCode.emailTaken) setAccountExists(true);
        setBusy(false);
      }
      return;
    }

    // ── Client connecté ────────────────────────────────────────────
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

      const res = await cartApi.checkout(
        addressId, true, deliveryMode, promo?.code ?? null, billingAddressId,
        garageId, slot,
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
      setError(errorMessage(e, "Erreur lors de la commande"));
      setBusy(false);
    }
  }

  if (loading) {
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
  if (user?.role === "garage") {
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

  // Un invité n'a pas de carnet : AddressPicker se réduit alors au
  // formulaire de saisie, sans liste ni bascule.
  const step = isGuest ? 1 : 0;

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
            {/* Coordonnées : invité uniquement */}
            {isGuest && (
              <Section title="1 · Vos coordonnées">
                <p className="mb-4 text-sm text-ink-soft">
                  Vous recevrez la confirmation et le suivi par email. Un
                  espace client est créé automatiquement — vous y accéderez
                  plus tard via «&nbsp;mot de passe oublié&nbsp;».{" "}
                  <Link
                    href="/connexion?next=/checkout"
                    className="font-semibold text-signal hover:underline"
                  >
                    Déjà un compte ? Se connecter
                  </Link>
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Email" value={email} onChange={setEmail} />
                  <Input
                    label="Téléphone"
                    value={phone}
                    onChange={setPhone}
                    required={false}
                  />
                  <Input label="Prénom" value={firstName} onChange={setFirstName} />
                  <Input label="Nom" value={lastName} onChange={setLastName} />
                </div>
              </Section>
            )}

            {/* Adresse */}
            <Section title={`${step + 1} · Adresse de livraison`}>
              <AddressPicker
                radioName="addr"
                addresses={addresses}
                selectedId={selectedId}
                onSelect={setSelectedId}
                showNew={isGuest || showNew}
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
                    aria-label="L'adresse de facturation est identique"
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
                      showNew={isGuest || showNewBilling}
                      onShowNew={setShowNewBilling}
                      draft={newBilling}
                      onDraft={setNewBilling}
                    />
                  </div>
                )}
              </div>
            </Section>

            {/* Livraison */}
            <Section title={`${step + 2} · Mode de livraison`}>
              <DeliveryModeSelector
                mode={deliveryMode}
                onSelectHome={() => {
                  setDeliveryMode("home");
                  setSelectedGarage(null);
                  setMountingAt(null);
                }}
                onSelectPartner={() => setDeliveryMode("partner_garage")}
                shippingHt={cart.shipping_ht}
                isFreeShipping={isFreeShipping}
                selectedGarage={selectedGarage}
                onSelectGarage={(g) => {
                  setSelectedGarage(g);
                  setMountingAt(null);
                }}
                mountingAt={mountingAt}
                onSelectSlot={setMountingAt}
              />
            </Section>

            {/* CGV */}
            <Section title={`${step + 3} · Conditions générales`}>
              <label className="flex items-start gap-3 text-sm">
                {/* aria-label explicite : le <label> enveloppe un lien,
                    ce qui rend le nom accessible de la case peu
                    exploitable, au lecteur d'écran comme au test. */}
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  aria-label="J'accepte les conditions générales de vente"
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

            {accountExists && (
              <p className="rounded-xl border border-signal/40 bg-signal-light p-4 text-sm">
                <Link
                  href="/connexion?next=/checkout"
                  className="font-bold text-signal underline"
                >
                  Se connecter et reprendre ma commande
                </Link>{" "}
                <span className="text-ink-soft">— votre panier est conservé.</span>
              </p>
            )}
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
            showPromo={!isGuest}
            articlesTtc={articlesTtc}
            discountTtc={discountTtc}
            shippingTtc={shippingTtc}
            grandTotal={grandTotal}
            priceChanges={priceChanges}
            error={error}
            busy={busy}
            acceptTerms={acceptTerms}
            onSubmit={handleSubmit}
            submitLabel={isGuest ? "Continuer vers le paiement" : undefined}
          />
        </div>
      </main>
    </>
  );
}
