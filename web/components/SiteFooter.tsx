import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-line bg-paper">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-lg font-black text-ink">tousvospneus.com</p>
          <p className="mt-2 text-sm text-ink-muted">
            Pneus au meilleur prix, livrés chez vous ou montés chez nos
            partenaires.
          </p>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-muted">
            Catalogue
          </p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/recherche" className="text-ink-soft hover:text-signal">Recherche par dimensions</Link></li>
            <li><Link href="/recherche?width=205&ratio=55&diameter=16" className="text-ink-soft hover:text-signal">205/55 R16</Link></li>
            <li><Link href="/recherche?width=225&ratio=45&diameter=17" className="text-ink-soft hover:text-signal">225/45 R17</Link></li>
            <li><Link href="/recherche?width=195&ratio=65&diameter=15" className="text-ink-soft hover:text-signal">195/65 R15</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-muted">
            Service client
          </p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/compte" className="text-ink-soft hover:text-signal">Mon compte</Link></li>
            <li><Link href="/cgv" className="text-ink-soft hover:text-signal">Conditions générales</Link></li>
            <li>
              <a href="mailto:contact@tousvospneus.com" className="text-ink-soft hover:text-signal">
                contact@tousvospneus.com
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-muted">
            Informations
          </p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/mentions-legales" className="text-ink-soft hover:text-signal">Mentions légales</Link></li>
            <li><Link href="/confidentialite" className="text-ink-soft hover:text-signal">Confidentialité</Link></li>
            <li><Link href="/cgv" className="text-ink-soft hover:text-signal">CGV</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-4 text-xs text-ink-muted sm:flex-row">
          <p>© {year} Tous Vos Pneus — Tous droits réservés.</p>
          <p>Paiement sécurisé · Société Générale Sogecommerce</p>
        </div>
      </div>
    </footer>
  );
}
