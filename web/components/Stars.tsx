/** Étoiles de notation.
 *
 *  Lecture seule par défaut ; `onChange` la rend cliquable. Les deux
 *  usages partagent le même dessin, sinon la note saisie ne ressemble
 *  pas à la note affichée juste après.
 */
export function Stars({
  value,
  size = 18,
  onChange,
  label,
}: {
  value: number;
  size?: number;
  onChange?: (n: number) => void;
  label?: string;
}) {
  const etoiles = [1, 2, 3, 4, 5];

  if (!onChange) {
    return (
      <span
        className="inline-flex items-center gap-0.5"
        role="img"
        aria-label={`${value} sur 5`}
      >
        {etoiles.map((n) => (
          <Etoile key={n} pleine={n <= Math.round(value)} size={size} />
        ))}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1"
      role="radiogroup"
      aria-label={label ?? "Note"}
    >
      {etoiles.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          className="rounded p-0.5 transition hover:scale-110"
        >
          <Etoile pleine={n <= value} size={size + 6} />
        </button>
      ))}
    </span>
  );
}

function Etoile({ pleine, size }: { pleine: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden
      className={pleine ? "text-amber-400" : "text-line"}
      fill="currentColor"
    >
      <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
    </svg>
  );
}
