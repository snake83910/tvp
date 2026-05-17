import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="relative z-10 border-b border-ink-muted">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="group flex items-center gap-3">
          {/* Pictogramme roue/pneu rappelant le logo */}
          <span className="relative flex h-9 w-9 items-center justify-center">
            <span className="absolute inset-0 rounded-full border-2 border-bone" />
            <span className="absolute inset-[6px] rounded-full border-2 border-signal" />
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tightest">
            TOUSVOSPNEUS<span className="text-signal">.COM</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-bone-dim md:flex">
          <Link
            href="/recherche"
            className="transition hover:text-bone"
          >
            Rechercher
          </Link>
          <Link
            href="/pro"
            className="transition hover:text-bone"
          >
            Espace pro
          </Link>
          <Link
            href="/connexion"
            className="rounded-full border border-ink-muted px-4 py-2 transition hover:border-signal hover:text-bone"
          >
            Mon compte
          </Link>
        </nav>
      </div>
    </header>
  );
}
