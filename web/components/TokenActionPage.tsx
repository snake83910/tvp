"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { apiError, errorMessage } from "@/lib/errors";

const BROWSER_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Page « j'ai cliqué sur un lien reçu par email ».
 *
 * Deux pages en vivaient : vérification d'adresse à l'inscription et
 * confirmation d'un changement d'adresse. Même squelette — lire `?token`,
 * le poster, afficher l'issue — pour quatre libellés et un endpoint de
 * différence. Elles avaient déjà commencé à diverger (un survol de bouton
 * d'un côté seulement), et toute page à venir du même genre
 * (désinscription, validation d'un devis) aurait été une troisième copie.
 */
export function TokenActionPage(props: {
  /** Chemin API appelé en POST avec `{ token }`. */
  endpoint: string;
  pendingLabel: string;
  successTitle: string;
  successText: string;
  errorTitle: string;
}) {
  return (
    <>
      <SiteHeader />
      <Suspense
        fallback={
          <main className="mx-auto max-w-md px-6 py-16">
            <p className="text-ink-muted">{props.pendingLabel}</p>
          </main>
        }
      >
        <TokenAction {...props} />
      </Suspense>
    </>
  );
}

function TokenAction({
  endpoint,
  pendingLabel,
  successTitle,
  successText,
  errorTitle,
}: {
  endpoint: string;
  pendingLabel: string;
  successTitle: string;
  successText: string;
  errorTitle: string;
}) {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [result, setResult] = useState<{
    state: "ok" | "error";
    msg: string;
  } | null>(null);

  useEffect(() => {
    // Token absent : aucun setState ici — la branche est DÉRIVÉE au rendu
    // (cf. plus bas). Un setState synchrone dans l'effet déclencherait un
    // rendu en cascade pour un état connu dès le premier rendu.
    if (!token) return;
    let cancelled = false;
    fetch(`${BROWSER_API}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        if (cancelled) return;
        if (r.ok) {
          setResult({ state: "ok", msg: "" });
        } else {
          const e = await apiError(r);
          setResult({ state: "error", msg: e.message });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setResult({
            state: "error",
            msg: errorMessage(e, "Erreur réseau, réessayez."),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, endpoint]);

  // Sans token, l'issue est connue sans appel réseau : on la dérive.
  const view = !token
    ? { state: "error" as const, msg: "Lien invalide." }
    : (result ?? { state: "pending" as const, msg: "" });

  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      {view.state === "pending" && (
        <p className="text-ink-muted">{pendingLabel}</p>
      )}
      {view.state === "ok" && (
        <>
          <h1 className="font-display text-3xl font-black text-ok">
            {successTitle}
          </h1>
          <p className="mt-3 text-sm text-ink-soft">{successText}</p>
          <Link
            href="/compte"
            className="mt-6 inline-block rounded-full bg-signal px-6 py-3 text-sm font-bold text-white transition hover:bg-signal-dark"
          >
            Accéder à mon compte
          </Link>
        </>
      )}
      {view.state === "error" && (
        <>
          <h1 className="font-display text-3xl font-black text-signal-dark">
            {errorTitle}
          </h1>
          <p className="mt-3 text-sm text-ink-soft">{view.msg}</p>
          <Link
            href="/connexion"
            className="mt-6 inline-block text-sm font-semibold text-signal hover:underline"
          >
            Retour à la connexion
          </Link>
        </>
      )}
    </main>
  );
}
