"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { getToken } from "@/lib/auth";

const BROWSER_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function PaiementRetourPage() {
  return (
    <>
      <SiteHeader />
      <Suspense
        fallback={
          <main className="mx-auto max-w-lg px-6 py-20 text-center">
            <p className="text-ink-muted">Chargement…</p>
          </main>
        }
      >
        <RetourContent />
      </Suspense>
    </>
  );
}

function RetourContent() {
  const router = useRouter();
  const params = useSearchParams();
  const orderNumber = params.get("cmd");
  const refused = params.get("status") === "refused";
  const [countdown, setCountdown] = useState(3);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncDone = useRef(false);

  // Après un paiement réussi, on tente de synchroniser le statut via l'API Sogecommerce.
  // Si l'IPN serveur arrive avant (via ngrok en prod), la sync est idempotente.
  // Si l'IPN n'est pas reçu (dev local sans tunnel), la sync prend le relais.
  useEffect(() => {
    if (!orderNumber || refused || syncDone.current) return;
    syncDone.current = true;

    async function syncAndRedirect() {
      setSyncing(true);
      try {
        const res = await fetch(
          `${BROWSER_API}/payment/sync/${orderNumber}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${getToken()}` },
          }
        );
        // 200 → synced ou already_processed, on continue
        // On ignore les erreurs de sync (PSP_100 si Order/Get pas activé)
        // L'IPN serveur ou le webhook mettra à jour le statut
      } catch {
        // Erreur réseau : on ignore et on redirige quand même
      } finally {
        setSyncing(false);
        setSyncError(null); // on n'affiche pas d'erreur si sync indispo
        // Countdown de redirection (3s)
        let n = 3;
        setCountdown(n);
        const interval = setInterval(() => {
          n -= 1;
          setCountdown(n);
          if (n <= 0) {
            clearInterval(interval);
            router.push(`/commande/${orderNumber}`);
          }
        }, 1000);
      }
    }

    syncAndRedirect();
  }, [orderNumber, refused, router]);

  // Pour les paiements refusés : juste le countdown vers la page commande
  useEffect(() => {
    if (!orderNumber || !refused) return;
    const interval = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(interval);
          router.push(`/commande/${orderNumber}`);
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [orderNumber, refused, router]);

  return (
    <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
      {refused ? (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-signal-light">
            <svg
              className="h-8 w-8 text-signal"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="mt-6 font-display text-2xl font-black text-ink">
            Paiement refusé
          </h1>
          <p className="mt-3 text-ink-muted">
            Votre paiement n&apos;a pas abouti. Vous allez être redirigé dans{" "}
            <span className="font-semibold text-ink">{countdown}s</span>.
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            Vous pourrez réessayer depuis la page commande.
          </p>
        </>
      ) : (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ok/10">
            <svg
              className="h-8 w-8 text-ok"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="mt-6 font-display text-2xl font-black text-ink">
            Paiement confirmé
          </h1>
          <p className="mt-3 text-ink-muted">
            {syncing
              ? "Confirmation en cours…"
              : `Merci pour votre commande ! Redirection dans ${countdown}s…`}
          </p>
          {syncError && (
            <p className="mt-2 text-sm text-signal">{syncError}</p>
          )}
        </>
      )}

      {orderNumber && (
        <button
          onClick={() => router.push(`/commande/${orderNumber}`)}
          className="mt-8 rounded-full bg-signal px-6 py-3 text-sm font-bold text-white transition hover:bg-signal-dark"
        >
          Voir ma commande →
        </button>
      )}
    </main>
  );
}
