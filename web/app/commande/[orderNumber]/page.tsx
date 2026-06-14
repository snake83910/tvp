"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { useCart } from "@/components/CartProvider";
import { useCurrentUser } from "@/lib/auth";

export default function OrderConfirmationPage({
  params,
}: {
  params: { orderNumber: string };
}) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const { refresh } = useCart();

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  // Le panier a été consommé côté serveur, on rafraîchit le compteur
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-ok/15">
          <svg
            viewBox="0 0 24 24"
            className="h-10 w-10 text-ok"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="mt-6 font-display text-3xl font-black tracking-tightest text-ink">
          Merci pour votre commande !
        </h1>
        <p className="mt-2 text-ink-muted">
          Votre commande{" "}
          <span className="font-mono font-bold text-ink">
            {params.orderNumber}
          </span>{" "}
          a bien été enregistrée et payée.
        </p>
        <p className="mt-4 text-sm text-ink-muted">
          Un email de confirmation va vous être envoyé. Vous pouvez
          suivre votre commande depuis votre espace client.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/compte"
            className="rounded-full bg-signal px-6 py-3 font-bold text-white hover:bg-signal-dark"
          >
            Voir mes commandes
          </Link>
          <Link
            href="/recherche"
            className="rounded-full border border-line px-6 py-3 font-bold text-ink-soft hover:border-signal hover:text-signal"
          >
            Continuer mes achats
          </Link>
        </div>
      </main>
    </>
  );
}
