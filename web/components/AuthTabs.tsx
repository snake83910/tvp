import Link from "next/link";

/** Onglets Se connecter / Créer un compte partagés par les deux pages. */
export function AuthTabs({ active }: { active: "login" | "register" }) {
  const base =
    "flex-1 border-b-2 py-3 text-center text-sm font-bold uppercase tracking-wide transition";
  return (
    <div className="flex">
      <Link
        href="/connexion"
        className={`${base} ${
          active === "login"
            ? "border-signal text-signal"
            : "border-line text-ink-muted hover:text-ink"
        }`}
        aria-current={active === "login" ? "page" : undefined}
      >
        Se connecter
      </Link>
      <Link
        href="/inscription"
        className={`${base} ${
          active === "register"
            ? "border-signal text-signal"
            : "border-line text-ink-muted hover:text-ink"
        }`}
        aria-current={active === "register" ? "page" : undefined}
      >
        Créer un compte
      </Link>
    </div>
  );
}
