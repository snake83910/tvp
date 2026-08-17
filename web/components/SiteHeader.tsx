"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { useCurrentUser } from "@/lib/auth";

export function SiteHeader() {
  const { count } = useCart();
  const { user, loading } = useCurrentUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Un compte garage n'est PAS un client : pas de « Mon compte », pas de
  // panier — uniquement l'accès à son espace partenaire.
  const isGarage = user?.role === "garage";
  const accountHref = user ? "/compte" : "/connexion";
  const accountLabel = user
    ? user.first_name ? `Bonjour ${user.first_name}` : "Mon compte"
    : "Connexion";

  // Fermeture au clavier : un panneau modal doit se fermer par Échap,
  // sinon la seule sortie est un clic précis sur la croix ou le voile.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // Verrouille le défilement de la page : sans ça, faire défiler par
    // dessus le tiroir déplace le contenu du site derrière lui.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 rounded">
          <span className="relative flex h-9 w-9 items-center justify-center">
            <span className="absolute inset-0 rounded-full border-2 border-ink" />
            <span className="absolute inset-[6px] rounded-full border-2 border-signal" />
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tightest text-ink">
            TOUSVOSPNEUS<span className="text-signal">.COM</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-ink-soft md:flex">
          {isGarage ? (
            <Link
              href="/partenaire"
              className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-paper transition hover:bg-signal"
            >
              Espace partenaire
            </Link>
          ) : (
            <>
              <Link href="/recherche" className="transition hover:text-signal">Rechercher</Link>
              <Link href="/montage-pneu" className="transition hover:text-signal">Montage</Link>
              {/* Suivi de commande : la question la plus posée au service
                  client, et jusqu'ici accessible seulement par le pied de
                  page. La majorité des acheteurs commandent sans compte —
                  « Mon compte » ne leur parle pas. */}
              <Link href="/suivi" className="transition hover:text-signal">Suivi</Link>
              <Link href={accountHref} className="transition hover:text-signal">
                {loading ? "Mon compte" : accountLabel}
              </Link>
              <Link
                href="/panier"
                className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-paper transition hover:bg-signal"
              >
                Panier
                {count > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-signal px-1.5 text-xs font-bold text-white">
                    {count}
                  </span>
                )}
              </Link>
            </>
          )}
        </nav>

        {/* Mobile : panier + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          {!isGarage && (
            <Link
              href="/panier"
              className="flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-sm font-semibold text-paper"
              aria-label="Panier"
            >
              <span aria-hidden>🛒</span>
              {count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-signal px-1.5 text-xs font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
          )}
          {/* 44x44 minimum : cible tactile recommandée (WCAG 2.5.5).
              Le bouton mesurait 32x42, ce qui se rate au pouce. */}
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-lg text-ink-soft"
            aria-label="Ouvrir le menu"
            aria-expanded={mobileOpen}
          >
            ☰
          </button>
        </div>
      </div>
      </header>

      {/* Tiroir mobile — VOLONTAIREMENT hors du <header>.
          L'en-tête porte `backdrop-blur`, et backdrop-filter crée un bloc
          conteneur pour les descendants en position:fixed. À l'intérieur,
          le `fixed inset-0` du tiroir se calait donc sur la boîte de
          l'en-tête (375x74 px) au lieu de la fenêtre : le panneau était
          rogné à la hauteur du bandeau et le contenu de la page
          transparaissait derrière les entrées du menu, illisibles. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex md:hidden"
          onClick={() => setMobileOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex-1 bg-ink/40" />
          <div
            className="flex w-72 flex-col bg-paper p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-base font-extrabold text-ink">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded p-2 text-ink-soft"
                aria-label="Fermer"
              >✕</button>
            </div>
            <nav className="space-y-2 text-sm font-semibold">
              <Link onClick={() => setMobileOpen(false)} href="/" className="block rounded-lg px-3 py-2.5 text-ink-soft hover:bg-paper-dim">Accueil</Link>
              {isGarage ? (
                <Link onClick={() => setMobileOpen(false)} href="/partenaire" className="block rounded-lg px-3 py-2.5 font-semibold text-signal hover:bg-paper-dim">Espace partenaire</Link>
              ) : (
                <>
                  <Link onClick={() => setMobileOpen(false)} href="/recherche" className="block rounded-lg px-3 py-2.5 text-ink-soft hover:bg-paper-dim">Rechercher des pneus</Link>
                  <Link onClick={() => setMobileOpen(false)} href="/montage-pneu" className="block rounded-lg px-3 py-2.5 text-ink-soft hover:bg-paper-dim">Montage en garage</Link>
                  <Link onClick={() => setMobileOpen(false)} href="/suivi" className="block rounded-lg px-3 py-2.5 text-ink-soft hover:bg-paper-dim">Suivre ma commande</Link>
                  <Link onClick={() => setMobileOpen(false)} href={accountHref} className="block rounded-lg px-3 py-2.5 text-ink-soft hover:bg-paper-dim">{accountLabel}</Link>
                  <Link onClick={() => setMobileOpen(false)} href="/panier" className="block rounded-lg px-3 py-2.5 text-ink-soft hover:bg-paper-dim">Panier ({count})</Link>
                </>
              )}
              <hr className="my-3 border-line" />
              <Link onClick={() => setMobileOpen(false)} href="/a-propos" className="block px-3 py-1.5 text-xs text-ink-muted hover:text-signal">À propos</Link>
              <Link onClick={() => setMobileOpen(false)} href="/cgv" className="block px-3 py-1.5 text-xs text-ink-muted hover:text-signal">CGV</Link>
              <Link onClick={() => setMobileOpen(false)} href="/mentions-legales" className="block px-3 py-1.5 text-xs text-ink-muted hover:text-signal">Mentions légales</Link>
              <Link onClick={() => setMobileOpen(false)} href="/confidentialite" className="block px-3 py-1.5 text-xs text-ink-muted hover:text-signal">Confidentialité</Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
