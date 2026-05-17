const ITEMS = [
  { t: "Livraison à domicile", d: "ou en garage partenaire" },
  { t: "Paiement sécurisé", d: "par Sogecommerce" },
  { t: "Montage possible", d: "près de chez vous" },
  { t: "Retour 14 jours", d: "satisfait ou remboursé" },
];

export function TrustBar() {
  return (
    <div className="border-y border-line bg-paper">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px md:grid-cols-4">
        {ITEMS.map((i) => (
          <div
            key={i.t}
            className="flex flex-col items-center px-4 py-4 text-center"
          >
            <span className="text-sm font-bold text-ink">
              {i.t}
            </span>
            <span className="text-xs text-ink-muted">{i.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
