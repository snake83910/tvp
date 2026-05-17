import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
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
          <Link href="/recherche" className="transition hover:text-signal">
            Rechercher
          </Link>
          <Link href="/conseils" className="transition hover:text-signal">
            Conseils
          </Link>
          <Link
            href="/connexion"
            className="flex items-center gap-2 transition hover:text-signal"
          >
            Mon compte
          </Link>
          <Link
            href="/panier"
            className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-paper transition hover:bg-signal"
          >
            Panier
          </Link>
        </nav>

        <Link
          href="/panier"
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper md:hidden"
        >
          Panier
        </Link>
      </div>
    </header>
  );
}
