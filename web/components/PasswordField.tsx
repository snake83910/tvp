"use client";

import { useState } from "react";

/**
 * Champ mot de passe avec bouton « afficher » et, en option, la
 * checklist EN DIRECT des règles backend (core/password_policy.py) :
 * l'utilisateur voit ce qui manque AVANT de soumettre, au lieu de
 * découvrir la politique via un message d'erreur.
 */

export interface PasswordRule {
  label: string;
  ok: (pwd: string) => boolean;
}

// Miroir de la politique backend : 10 caractères min, une majuscule,
// un chiffre OU un caractère spécial.
export const PASSWORD_RULES: PasswordRule[] = [
  { label: "10 caractères minimum", ok: (p) => p.length >= 10 },
  { label: "Une majuscule", ok: (p) => /[A-Z]/.test(p) },
  {
    label: "Un chiffre ou caractère spécial",
    ok: (p) => /\d/.test(p) || /[^A-Za-z0-9]/.test(p),
  },
];

export function passwordMeetsRules(pwd: string): boolean {
  return PASSWORD_RULES.every((r) => r.ok(pwd));
}

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  showChecklist = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  showChecklist?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full rounded-lg border border-line bg-paper px-3 pr-12 text-ink outline-none transition focus:border-signal"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-muted transition hover:text-signal"
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          title={visible ? "Masquer" : "Afficher"}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
              <path d="M3 3l18 18" strokeLinecap="round" />
              <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 8.6 4 9.8 6.3.13.26.13.55 0 .8a13.2 13.2 0 0 1-2.6 3.3M6.6 6.7C4.6 8 3 9.9 2.2 11.3a.9.9 0 0 0 0 .8C3.4 14.4 7 18.4 12 18.4c1.3 0 2.5-.26 3.6-.7" strokeLinecap="round" />
              <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
              <path d="M2.2 11.3C3.4 9 7 5 12 5s8.6 4 9.8 6.3c.13.26.13.55 0 .8C20.6 14.4 17 18.4 12 18.4S3.4 14.4 2.2 12.1a.9.9 0 0 1 0-.8z" />
              <circle cx="12" cy="11.7" r="3" />
            </svg>
          )}
        </button>
      </div>

      {showChecklist && value.length > 0 && (
        <ul className="mt-2 space-y-1" aria-live="polite">
          {PASSWORD_RULES.map((r) => {
            const ok = r.ok(value);
            return (
              <li
                key={r.label}
                className={`flex items-center gap-2 text-xs ${
                  ok ? "text-ok" : "text-ink-muted"
                }`}
              >
                <span aria-hidden>{ok ? "✓" : "○"}</span>
                {r.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
