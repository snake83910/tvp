"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearTokens, useCurrentUser } from "@/lib/auth";

/** En-tête propre à l'espace partenaire — distinct de la boutique. */
export function PartnerHeader() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const isGarage = user?.role === "garage";

  function logout() {
    clearTokens();
    router.replace("/connexion?next=/partenaire");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink text-paper">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3.5">
        <Link
          href={isGarage ? "/partenaire" : "/connexion?next=/partenaire"}
          className="flex items-center gap-2.5"
        >
          <span className="font-display text-base font-extrabold tracking-tightest">
            TOUSVOSPNEUS<span className="text-signal">.COM</span>
          </span>
          <span className="rounded-full bg-signal px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Partenaires
          </span>
        </Link>

        {isGarage && (
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-paper/70 sm:inline">{user?.email}</span>
            <button
              onClick={logout}
              className="rounded-lg border border-paper/30 px-3 py-1.5 font-semibold text-paper transition hover:bg-paper/10"
            >
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
