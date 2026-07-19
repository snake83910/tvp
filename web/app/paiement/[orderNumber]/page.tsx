"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { CheckoutSteps } from "@/components/CheckoutSteps";
import {
  accountApi,
  authFetch,
  useCurrentUser,
  type OrderDetail,
} from "@/lib/auth";
import { formatEuro } from "@/lib/money";

// Endpoint Sogecommerce (identique à la variable d'env backend)
const SOGE_ENDPOINT =
  process.env.NEXT_PUBLIC_SOGE_ENDPOINT ||
  "https://api-sogecommerce.societegenerale.eu";

// Thème néon (recommandé par la doc Sogecommerce) : le CSS applique le
// thème de base pendant le chargement, le JS contient la partie ACTIVE
// du thème (styles finaux, animations, éléments). Sans neon.js, le
// formulaire s'affiche brut — c'était la cause du rendu bas de gamme.
const SOGE_THEME_CSS = `${SOGE_ENDPOINT}/static/js/krypton-client/V4.0/ext/neon-reset.min.css`;
const SOGE_THEME_JS = `${SOGE_ENDPOINT}/static/js/krypton-client/V4.0/ext/neon.js`;

interface PaymentInit {
  provider: string;
  provider_ref: string;
  form_token: string;
  amount_cents: number;
  public_key: string;
}

export default function PaymentPage({
  params,
}: {
  params: { orderNumber: string };
}) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [init, setInit] = useState<PaymentInit | null>(null);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const krRef = useRef<any>(null);

  useEffect(() => {
    if (!loading && !user)
      router.push(`/connexion?next=/paiement/${params.orderNumber}`);
  }, [loading, user, router, params.orderNumber]);

  // Récapitulatif de commande (articles, livraison, adresse). Si la
  // commande n'est plus payable (déjà payée, annulée...), on renvoie
  // vers sa page de suivi au lieu d'afficher une erreur d'init.
  useEffect(() => {
    if (!user) return;
    accountApi
      .getOrder(params.orderNumber)
      .then((o) => {
        if (o.status !== "pending_payment") {
          router.replace(`/commande/${params.orderNumber}`);
        } else {
          setOrder(o);
        }
      })
      .catch(() => {
        // Récap indisponible : le paiement reste possible (montant
        // affiché depuis l'init serveur)
      });
  }, [user, params.orderNumber, router]);

  // 1. Initialise le paiement côté serveur → récupère formToken + publicKey
  useEffect(() => {
    if (!user) return;
    authFetch(`/payment/init/${params.orderNumber}`, { method: "POST" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail ?? "Erreur");
        return r.json();
      })
      .then(setInit)
      .catch((e) => setError(e.message));
  }, [user, params.orderNumber]);

  // 2. Monte le smartForm Sogecommerce (thème néon complet)
  useEffect(() => {
    if (!init || init.provider !== "sogecommerce") return;

    if (!init.public_key) {
      setError(
        "Clé publique Sogecommerce manquante. " +
          "Ajoutez SOGECOMMERCE_PUBLIC_KEY dans le .env " +
          "(Back Office → Clés d'API REST → « Clé publique de test »).",
      );
      return;
    }

    let cancelled = false;

    // Thème : CSS dans le head + neon.js AVANT la librairie principale
    // (exigence documentée — c'est lui qui porte le rendu final).
    async function ensureThemeAssets(): Promise<void> {
      if (!document.querySelector(`link[href="${SOGE_THEME_CSS}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = SOGE_THEME_CSS;
        document.head.appendChild(link);
      }
      if (!document.querySelector(`script[src="${SOGE_THEME_JS}"]`)) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = SOGE_THEME_JS;
          s.onload = () => resolve();
          s.onerror = () =>
            reject(new Error("Thème du formulaire de paiement indisponible"));
          document.head.appendChild(s);
        });
      }
    }

    async function mountKrypton() {
      try {
        await ensureThemeAssets();

        // Import dynamique pour éviter le SSR
        const { default: KRGlue } = await import(
          "@lyracom/embedded-form-glue"
        );
        if (cancelled) return;

        const refusedUrl = `${window.location.origin}/paiement/retour?cmd=${params.orderNumber}&status=refused`;

        const { KR } = await KRGlue.loadLibrary(
          SOGE_ENDPOINT,
          init!.public_key,
        );
        if (cancelled) { KR.removeForms(); return; }

        await KR.setFormConfig({
          formToken: init!.form_token,
          "kr-language": "fr-FR",
          "kr-get-url-refused": refusedUrl,
        });

        await KR.onSubmit((paymentData: any) => {
          // kr-answer et kr-hash retournés par Krypton au navigateur après paiement
          const krAnswer: string =
            paymentData.rawClientAnswer ??
            JSON.stringify(paymentData.clientAnswer);
          const krHash: string = paymentData.hash;
          // fire-and-forget : on navigue sans attendre la réponse backend
          authFetch(`/payment/verify-kr-answer/${params.orderNumber}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kr_answer: krAnswer, kr_hash: krHash }),
          }).catch(() => {});
          router.push(`/paiement/retour?cmd=${params.orderNumber}`);
          return false; // empêche la soumission du formulaire par Krypton
        });

        await KR.onError((e: any) => {
          const msg =
            e?.errorMessage || e?.detailedErrorMessage || JSON.stringify(e);
          setError(`Erreur Krypton : ${msg}`);
        });

        // onFormReady existe dans l'API Krypton mais manque dans les
        // types de embedded-form-glue — d'où le cast.
        (KR as any).onFormReady(() => {
          if (!cancelled) setFormReady(true);
        });

        await KR.renderElements("#soge-smartform");
        if (cancelled) { KR.removeForms(); return; }

        krRef.current = KR;
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? String(err));
      }
    }

    mountKrypton();

    return () => {
      cancelled = true;
      if (krRef.current) {
        krRef.current.removeForms();
        krRef.current = null;
      }
      setFormReady(false);
    };
  }, [init, params.orderNumber]);

  async function simulatePayment() {
    if (!init) return;
    setSimBusy(true);
    try {
      const res = await authFetch(
        `/payment/simulate/${params.orderNumber}`,
        { method: "POST" },
      );
      if (res.ok) {
        router.push(`/commande/${params.orderNumber}`);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.detail ?? "Simulation refusée");
      }
    } finally {
      setSimBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-16">
          <p className="text-ink-muted">Chargement…</p>
        </main>
      </>
    );
  }

  const amountTtc = init ? init.amount_cents / 100 : order?.total_ttc ?? null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-4 font-display text-3xl font-black tracking-tightest text-ink">
          Paiement
        </h1>
        <CheckoutSteps current={3} />

        {error && (
          <div className="mt-6 rounded-xl border border-signal/40 bg-signal-light p-5">
            <p className="font-semibold text-signal-dark">
              Le paiement n&apos;a pas pu être initialisé
            </p>
            <p className="mt-1 text-sm text-ink-soft">{error}</p>
            <Link
              href="/panier"
              className="mt-3 inline-block text-sm font-semibold text-signal hover:underline"
            >
              ← Retour au panier
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[360px_1fr] lg:items-start">
          {/* ── Récapitulatif ─────────────────────────────────────── */}
          <aside className="space-y-4 rounded-2xl border border-line bg-paper p-6 shadow-card lg:sticky lg:top-6">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
                Votre commande
              </p>
              <p className="font-mono text-xs text-ink-muted">
                {params.orderNumber}
              </p>
            </div>

            {order ? (
              <>
                <ul className="space-y-2 border-b border-line pb-4">
                  {order.items.map((it) => (
                    <li
                      key={it.supplier_ref}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <span className="text-ink-soft">
                        {it.label}{" "}
                        <span className="whitespace-nowrap text-ink-muted">
                          × {it.quantity}
                        </span>
                      </span>
                      <span className="whitespace-nowrap font-semibold text-ink">
                        {formatEuro(it.line_total_ttc)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-1.5 border-b border-line pb-4 text-sm">
                  <div className="flex justify-between text-ink-soft">
                    <span>Articles</span>
                    <span>{formatEuro(order.articles_ttc)}</span>
                  </div>
                  {(order.discount_ttc ?? 0) > 0 && (
                    <div className="flex justify-between text-ok">
                      <span>Remise{order.promo_code ? ` (${order.promo_code})` : ""}</span>
                      <span>−{formatEuro(order.discount_ttc ?? 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-ink-soft">
                    <span>Livraison</span>
                    <span>
                      {order.shipping_ttc === 0
                        ? "Offerte"
                        : formatEuro(order.shipping_ttc)}
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="font-display text-lg font-black text-ink">
                    Total TTC
                  </span>
                  <span className="font-display text-2xl font-black text-ink">
                    {formatEuro(order.total_ttc)}
                  </span>
                </div>

                {order.shipping_address?.line1 && (
                  <div className="rounded-lg bg-paper-dim px-3 py-2.5 text-xs text-ink-soft">
                    <p className="mb-0.5 font-bold uppercase tracking-wider text-ink-muted">
                      Livraison à domicile
                    </p>
                    {order.shipping_address.line1}
                    {order.shipping_address.line2
                      ? `, ${order.shipping_address.line2}`
                      : ""}
                    , {order.shipping_address.postal_code}{" "}
                    {order.shipping_address.city}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg font-black text-ink">
                  Total TTC
                </span>
                <span className="font-display text-2xl font-black text-ink">
                  {amountTtc != null ? formatEuro(amountTtc) : "…"}
                </span>
              </div>
            )}
          </aside>

          {/* ── Paiement ──────────────────────────────────────────── */}
          <section className="rounded-2xl border border-line bg-paper p-6 shadow-card md:p-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                <svg
                  className="h-5 w-5 shrink-0 text-ok"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
                Paiement sécurisé
              </h2>
              <div className="flex items-center gap-1.5">
                {["CB", "Visa", "Mastercard"].map((b) => (
                  <span
                    key={b}
                    className="rounded border border-line bg-paper-dim px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-soft"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>

            {!init && !error && (
              <PaymentSkeleton label="Initialisation du paiement…" />
            )}

            {init && init.provider === "sogecommerce" && (
              <>
                {/* Squelette pendant le chargement du formulaire bancaire */}
                {!formReady && !error && (
                  <PaymentSkeleton label="Chargement du formulaire bancaire…" />
                )}

                {/* smartForm Sogecommerce (thème néon) : carte + moyens de
                    paiement gérés par la banque, champs PCI-DSS isolés */}
                <div
                  id="soge-smartform"
                  className="soge-form-host"
                  style={{ display: formReady ? "block" : "none" }}
                >
                  <div
                    className="kr-smart-form"
                    {...{ "kr-card-form-expanded": "" }}
                  />
                </div>
              </>
            )}

            {/* Simulateur (dev uniquement) */}
            {init && init.provider === "simulated" && (
              <div className="rounded-xl border-2 border-dashed border-signal bg-signal-light p-6">
                <p className="text-sm font-bold text-signal-dark">
                  Mode développement — paiement simulé
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  En production, le formulaire Sogecommerce s&apos;affiche ici.
                </p>
                <button
                  onClick={simulatePayment}
                  disabled={simBusy}
                  className="mt-4 rounded-full bg-ink px-6 py-3 text-sm font-bold text-paper transition hover:bg-signal disabled:opacity-60"
                >
                  {simBusy ? "Simulation…" : "Simuler un paiement réussi"}
                </button>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 border-t border-line pt-5 text-[11px] text-ink-muted">
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                Authentification 3-D Secure
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Chiffrement SSL
              </span>
              <span>Société Générale — Sogecommerce</span>
            </div>
          </section>
        </div>

        {/* Porte de sortie explicite : si le client quitte cette page,
            la commande reste en attente — on lui dit quoi en faire au
            lieu de le laisser découvrir une commande « bloquée » */}
        <p className="mt-8 text-center text-xs text-ink-muted">
          Vous préférez régler plus tard ? Retrouvez cette commande dans{" "}
          <Link
            href="/compte?tab=orders"
            className="font-semibold text-signal hover:underline"
          >
            Mes commandes
          </Link>{" "}
          — vous pourrez la payer ou l&apos;annuler à tout moment
          (annulation automatique sans paiement sous 7 jours).
        </p>
      </main>
    </>
  );
}

/** Squelette : mime les champs carte + bouton pendant le chargement,
 * pour éviter le saut de mise en page et l'écran vide. */
function PaymentSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-3" role="status" aria-label={label}>
      <div className="h-12 animate-pulse rounded-lg bg-paper-dim" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-12 animate-pulse rounded-lg bg-paper-dim" />
        <div className="h-12 animate-pulse rounded-lg bg-paper-dim" />
      </div>
      <div className="h-12 animate-pulse rounded-full bg-paper-dim" />
      <p className="pt-1 text-center text-sm text-ink-muted">{label}</p>
    </div>
  );
}
