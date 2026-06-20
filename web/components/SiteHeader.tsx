"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { useCurrentUser } from "@/lib/auth";

export function SiteHeader() {
  const { count } = useCart();
  const { user, loading } = useCurrentUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  const accountHref = user ? "/compte" : "/connexion";
  const accountLabel = user
    ? user.first_name ? `Bonjour ${user.first_name}` : "Mon compte"
    : "Connexion";

  return (
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
          <Link href="/recherche" className="transition hover:text-signal">Rechercher</Link>
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
        </nav>

        {/* Mobile : panier + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
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
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg border border-line p-2 text-ink-soft"
            aria-label="Ouvrir le menu"
            aria-expanded={mobileOpen}
          >
            ☰
          </button>
        </div>
      </div>

      {/* Drawer mobile */}
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
              <Link onClick={() => setMobileOpen(false)} href="/recherche" className="block rounded-lg px-3 py-2.5 text-ink-soft hover:bg-paper-dim">Rechercher des pneus</Link>
              <Link onClick={() => setMobileOpen(false)} href={accountHref} className="block rounded-lg px-3 py-2.5 text-ink-soft hover:bg-paper-dim">{accountLabel}</Link>
              <Link onClick={() => setMobileOpen(false)} href="/panier" className="block rounded-lg px-3 py-2.5 text-ink-soft hover:bg-paper-dim">Panier ({count})</Link>
              <hr className="my-3 border-line" />
              <Link onClick={() => setMobileOpen(false)} href="/cgv" className="block px-3 py-1.5 text-xs text-ink-muted hover:text-signal">CGV</Link>
              <Link onClick={() => setMobileOpen(false)} href="/mentions-legales" className="block px-3 py-1.5 text-xs text-ink-muted hover:text-signal">Mentions légales</Link>
              <Link onClick={() => setMobileOpen(false)} href="/confidentialite" className="block px-3 py-1.5 text-xs text-ink-muted hover:text-signal">Confidentialité</Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
