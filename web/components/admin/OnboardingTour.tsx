"use client";

import { useState } from "react";
import { useLocalValue, writeLocal } from "@/lib/localStore";

const KEY = "tvp_admin_onboarding_v1";

const STEPS = [
  {
    title: "Bienvenue dans l'admin",
    body: "Voici un tour rapide des fonctionnalités principales (3 étapes).",
  },
  {
    title: "Raccourcis clavier",
    body: "Appuyez sur Ctrl+K (⌘K) pour ouvrir la palette de recherche. Tapez / pour focus la recherche. g+c pour les commandes, g+d pour le dashboard.",
  },
  {
    title: "Sécurité",
    body: "Pensez à activer le 2FA dans Sécurité 2FA, et à générer vos codes de secours pour ne pas être bloqué.",
  },
];

export function OnboardingTour() {
  // Visibilité DÉRIVÉE du localStorage (useSyncExternalStore) : l'ancien
  // useEffect qui faisait setStep(0) au montage forçait un rendu en
  // cascade. Valeur serveur "done" : le serveur et la passe d'hydratation
  // rendent le tour masqué (comme avant), puis React re-rend avec la
  // vraie valeur — le tour n'apparaît que si la clé est réellement
  // absente, sans flash chez ceux qui l'ont déjà fermé.
  const seen = useLocalValue(KEY, "done");
  const [step, setStep] = useState(0);

  if (seen !== null) return null;

  function close() {
    // writeLocal notifie le hook : le composant se re-rend, `seen`
    // devient non-null, le tour disparaît — pas d'état local de fermeture.
    writeLocal(KEY, "done");
  }

  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-paper p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-signal">
          Étape {step + 1} sur {STEPS.length}
        </p>
        <h2 className="mt-2 font-display text-xl font-black text-ink">{s.title}</h2>
        <p className="mt-3 text-sm text-ink-soft">{s.body}</p>
        <div className="mt-5 flex justify-between">
          <button
            onClick={close}
            className="text-xs font-semibold text-ink-muted hover:text-signal"
          >
            Passer le tour
          </button>
          <button
            onClick={() => last ? close() : setStep(step + 1)}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-paper hover:bg-signal"
          >
            {last ? "Terminer" : "Suivant →"}
          </button>
        </div>
      </div>
    </div>
  );
}
