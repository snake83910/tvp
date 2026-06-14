"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { getToken, useCurrentUser } from "@/lib/auth";

const BROWSER_API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Endpoint Sogecommerce (identique à la variable d'env backend)
const SOGE_ENDPOINT =
  process.env.NEXT_PUBLIC_SOGE_ENDPOINT ||
  "https://api-sogecommerce.societegenerale.eu";

// Thème CSS Krypton (chargé une seule fois dans le head)
const SOGE_THEME_CSS = `${SOGE_ENDPOINT}/static/js/krypton-client/V4.0/ext/neon-reset.min.css`;

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
  const [error, setError] = useState<string | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const cssTeardownRef = useRef<(() => void) | null>(null);
  const krRef = useRef<any>(null);

  useEffect(() => {
    if (!loading && !user)
      router.push(`/connexion?next=/paiement/${params.orderNumber}`);
  }, [loading, user, router, params.orderNumber]);

  // 1. Initialise le paiement côté serveur → récupère formToken + publicKey
  useEffect(() => {
    if (!user) return;
    fetch(`${BROWSER_API}/payment/init/${params.orderNumber}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail ?? "Erreur");
        return r.json();
      })
      .then(setInit)
      .catch((e) => setError(e.message));
  }, [user, params.orderNumber]);

  // 2. Charge le formulaire Sogecommerce via embedded-form-glue
  useEffect(() => {
    if (!init || init.provider !== "sogecommerce") return;

    if (!init.public_key) {
      setError(
        "Clé publique Sogecommerce manquante. " +
        "Ajoutez SOGECOMMERCE_PUBLIC_KEY dans le .env " +
        "(Back Office → Clés d'API REST → « Clé publique de test »)."
      );
      return;
    }

    let cancelled = false;

    async function mountKrypton() {
      try {
        // Charge le thème CSS de façon idempotente
        if (!document.querySelector(`link[href="${SOGE_THEME_CSS}"]`)) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = SOGE_THEME_CSS;
          document.head.appendChild(link);
          cssTeardownRef.current = () => document.head.removeChild(link);
        }

        // Import dynamique pour éviter le SSR
        const { default: KRGlue } = await import(
          "@lyracom/embedded-form-glue"
        );
        if (cancelled) return;

        const refusedUrl = `${window.location.origin}/paiement/retour?cmd=${params.orderNumber}&status=refused`;

        const { KR } = await KRGlue.loadLibrary(
          SOGE_ENDPOINT,
          init!.public_key
        );
        if (cancelled) { KR.removeForms(); return; }

        await KR.setFormConfig({
          formToken: init!.form_token,
          "kr-language": "fr-FR",
          "kr-get-url-refused": refusedUrl,
        });

        await KR.onSubmit((paymentData: any) => {
          // kr-answer et kr-hash retournés par Krypton au navigateur après paiement
          const krAnswer: string = paymentData.rawClientAnswer ?? JSON.stringify(paymentData.clientAnswer);
          const krHash: string = paymentData.hash;
          // fire-and-forget : on navigue sans attendre la réponse backend
          fetch(`${BROWSER_API}/payment/verify-kr-answer/${params.orderNumber}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({ kr_answer: krAnswer, kr_hash: krHash }),
          }).catch(() => {});
          router.push(`/paiement/retour?cmd=${params.orderNumber}`);
          return false; // empêche la soumission du formulaire par Krypton
        });

        await KR.onError((e: any) => {
          const msg = e?.errorMessage || e?.detailedErrorMessage || JSON.stringify(e);
          setError(`Erreur Krypton : ${msg}`);
        });

        await KR.renderElements(".kr-embedded");
        if (cancelled) { KR.removeForms(); return; }

        krRef.current = KR;
        setFormReady(true);
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
      cssTeardownRef.current?.();
      cssTeardownRef.current = null;
      setFormReady(false);
    };
  }, [init, params.orderNumber]);

  async function simulatePayment() {
    if (!init) return;
    setSimBusy(true);
    try {
      const res = await fetch(
        `${BROWSER_API}/payment/simulate/${params.orderNumber}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
        }
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

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="font-display text-3xl font-black tracking-tightest text-ink">
          Paiement
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Commande {params.orderNumber}
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-signal/40 bg-signal-light p-5">
            <p className="font-semibold text-signal-dark">
              Erreur lors de l&apos;initialisation
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

        {!init && !error && (
          <p className="mt-8 text-ink-muted">Initialisation…</p>
        )}

        {init && (
          <>
            {/* Récapitulatif montant */}
            <div className="mt-8 rounded-2xl border border-line bg-paper p-6 shadow-card">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
                Montant à régler
              </p>
              <p className="mt-2 font-display text-4xl font-black text-ink">
                {(init.amount_cents / 100).toFixed(2).replace(".", ",")} €
              </p>
            </div>

            {/* Formulaire Sogecommerce (prod) */}
            {init.provider === "sogecommerce" && (
              <div className="mt-6 rounded-2xl border border-line bg-paper p-6 shadow-card">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
                  Paiement sécurisé
                </p>

                {/* Le div .kr-embedded est rempli par KRGlue.renderElements() */}
                <div className="kr-embedded" />

                {!formReady && !error && (
                  <p className="mt-4 text-sm text-ink-muted">
                    Chargement du formulaire…
                  </p>
                )}

                <p className="mt-4 flex items-center gap-2 text-xs text-ink-muted">
                  <svg
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                  Paiement 100% sécurisé — Société Générale Sogecommerce
                </p>
              </div>
            )}

            {/* Simulateur (dev uniquement) */}
            {init.provider === "simulated" && (
              <div className="mt-6 rounded-2xl border-2 border-dashed border-signal bg-signal-light p-6">
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
          </>
        )}
      </main>
    </>
  );
}
