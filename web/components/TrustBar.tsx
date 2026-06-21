const ITEMS = [
  {
    t: "Livraison rapide",
    d: "à domicile ou en garage partenaire",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <rect x="2" y="6" width="12" height="11" rx="1.5" />
        <path d="M14 9h4l3 4v4h-7" />
        <circle cx="6" cy="18" r="2" fill="currentColor" stroke="none" />
        <circle cx="17" cy="18" r="2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    t: "Paiement sécurisé",
    d: "Société Générale Sogecommerce",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path d="M12 2l9 4v6c0 5-3.5 9-9 10C6.5 21 3 17 3 12V6l9-4z" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    t: "Garantie constructeur",
    d: "sur toute la gamme",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    t: "Rétractation 14 jours",
    d: "satisfait ou remboursé",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" strokeLinecap="round" />
        <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function TrustBar() {
  return (
    <div className="border-y border-line bg-paper">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px md:grid-cols-4">
        {ITEMS.map((i) => (
          <div
            key={i.t}
            className="flex flex-col items-center gap-2 px-4 py-5 text-center"
          >
            <span className="text-signal">{i.icon}</span>
            <span className="text-sm font-bold text-ink">{i.t}</span>
            <span className="text-xs text-ink-muted">{i.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
