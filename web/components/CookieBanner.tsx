"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "tvp_cookie_consent";

/**
 * Bannière minimaliste RGPD.
 *
 * Le site n'utilise actuellement QUE des cookies fonctionnels strictement
 * nécessaires (session, panier) — pas besoin de consentement explicite
 * pour ceux-là. La bannière est purement informative.
 *
 * Si tu ajoutes plus tard Google Analytics ou tout autre tracker, il faudra
 * passer à un vrai gestionnaire de consentement (Axeptio, Tarteaucitron, ...).
 */
export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(KEY)) setShow(true);
  }, []);

  function accept() {
    localStorage.setItem(KEY, "ack:" + new Date().toISOString());
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-paper p-4 shadow-card"
      role="dialog"
      aria-label="Information cookies"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft">
          Ce site utilise uniquement des cookies <strong>strictement nécessaires</strong>
          {" "}au fonctionnement (session, panier). Voir notre{" "}
          <Link href="/confidentialite" className="text-signal underline hover:text-signal-dark">
            politique de confidentialité
          </Link>.
        </p>
        <button
          onClick={accept}
          className="shrink-0 rounded-full bg-signal px-5 py-2 text-sm font-bold text-white transition hover:bg-signal-dark"
        >
          J&apos;ai compris
        </button>
      </div>
    </div>
  );
}
