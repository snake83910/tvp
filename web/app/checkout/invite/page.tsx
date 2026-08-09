"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Input } from "@/components/checkout/fields";
import { useCart } from "@/components/CartProvider";
import { cartApi } from "@/lib/cart";
import { saveTokens, getToken } from "@/lib/auth";
import { formatEuro } from "@/lib/money";

/**
 * Commande sans création de compte.
 *
 * Page distincte du tunnel connecté (/checkout) plutôt que branche
 * conditionnelle : le tunnel connecté travaille avec des identifiants
 * d'adresses déjà enregistrées, l'invité saisit la sienne à la volée. Les
 * mélanger dans un même écran obligerait à deux modes dans chaque champ,
 * pour un parcours qui doit rester le plus court possible.
 */
export default function GuestCheckoutPage() {
  const router = useRouter();
  const { cart, refresh } = useCart();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [terms, setTerms] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Déjà connecté : le tunnel normal est plus complet (adresses
  // enregistrées, historique). On y renvoie plutôt que de créer un
  // second compte à la même personne.
  useEffect(() => {
    if (getToken()) router.replace("/checkout");
  }, [router]);

  const empty = !cart || cart.items.length === 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setAccountExists(false);
    setBusy(true);
    try {
      const res = await cartApi.checkoutGuest({
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        shipping: {
          line1,
          line2: line2 || null,
          postal_code: postalCode,
          city,
          country: "FR",
          label: "Livraison",
        },
        accept_terms: terms,
      });

      // Les jetons AVANT la navigation : la page de paiement appelle
      // /payment/init, qui exige une session. Sans cet enregistrement, le
      // client arriverait sur un écran de paiement qui le rejette alors
      // que sa commande vient d'être créée.
      if (res.access_token && res.refresh_token) {
        saveTokens(res.access_token, res.refresh_token);
      }

      if (res.price_changes.length > 0) {
        // Prix fournisseur modifiés entre l'ajout au panier et la
        // validation : le backend n'a volontairement pas créé la commande.
        // Le tunnel connecté sait présenter ces écarts, et le client y a
        // désormais accès puisqu'il vient de recevoir ses jetons.
        router.push("/checkout?prix=modifies");
        return;
      }
      if (res.order_number) {
        router.push(`/paiement/${res.order_number}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Commande impossible";
      setError(msg);
      // 409 sur email connu : on ne laisse pas le client dans une impasse,
      // on lui ouvre le chemin de la connexion, panier conservé.
      if (/compte existe déjà/i.test(msg)) setAccountExists(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-2 font-display text-3xl font-black tracking-tightest text-ink">
          Commander sans compte
        </h1>
        <p className="mb-8 text-sm text-ink-soft">
          Vous recevrez la confirmation et le suivi par email. Un espace
          client est créé automatiquement — vous pourrez y accéder plus tard
          via «&nbsp;mot de passe oublié&nbsp;».
        </p>

        {empty ? (
          <p className="rounded-xl border border-line bg-paper p-6 text-ink-soft">
            Votre panier est vide.{" "}
            <Link href="/recherche" className="text-signal underline">
              Trouver des pneus
            </Link>
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <section className="rounded-2xl border border-line bg-paper p-6 shadow-card">
              <h2 className="mb-4 font-display text-lg font-bold text-ink">
                Vos coordonnées
              </h2>
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
            </section>

            <section className="rounded-2xl border border-line bg-paper p-6 shadow-card">
              <h2 className="mb-4 font-display text-lg font-bold text-ink">
                Adresse de livraison
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input label="Adresse" value={line1} onChange={setLine1} />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    label="Complément"
                    value={line2}
                    onChange={setLine2}
                    required={false}
                  />
                </div>
                <Input
                  label="Code postal"
                  value={postalCode}
                  onChange={setPostalCode}
                />
                <Input label="Ville" value={city} onChange={setCity} />
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-paper p-6 shadow-card">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-ink-soft">Total TTC</span>
                <span className="font-display text-2xl font-black text-ink">
                  {formatEuro(cart.grand_total_ttc || cart.total_ttc)}
                </span>
              </div>
              <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  className="mt-0.5 accent-signal"
                />
                <span>
                  J&apos;accepte les{" "}
                  <Link href="/cgv" className="text-signal underline" target="_blank">
                    conditions générales de vente
                  </Link>
                  .
                </span>
              </label>

              {error && (
                <div className="mt-4 rounded-lg border border-signal/40 bg-signal-light p-4 text-sm">
                  <p className="text-signal">{error}</p>
                  {accountExists && (
                    <Link
                      href="/connexion?next=/checkout"
                      className="mt-2 inline-block font-bold text-signal underline"
                    >
                      Se connecter et reprendre ma commande
                    </Link>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !terms}
                className="mt-5 w-full rounded-full bg-signal px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Création de la commande…" : "Continuer vers le paiement"}
              </button>
              <p className="mt-3 text-center text-xs text-ink-muted">
                🔒 Paiement sécurisé Société Générale · Rétractation 14 jours
              </p>
            </section>
          </form>
        )}
      </main>
    </>
  );
}
