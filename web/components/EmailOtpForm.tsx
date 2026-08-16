"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";

/** Durée du verrou de renvoi côté serveur (app/core/otp.py).
 *  Le compte à rebours n'est pas décoratif : sans lui, un clic sur
 *  « Renvoyer » pendant le verrou ne produirait aucun mail et l'écran
 *  prétendrait le contraire. */
const RESEND_COOLDOWN = 60;

const CODE_LENGTH = 6;

interface Props {
  /** Adresse à vérifier. Connue au paiement (le compte vient d'être créé),
   *  inconnue sur la page autonome — l'utilisateur la saisit alors. */
  email?: string;
  /** Vrai quand un code vient d'être envoyé sans que ce composant l'ait
   *  demandé : le verrou serveur court déjà, le rebours doit en tenir
   *  compte. */
  alreadySent?: boolean;
  onVerified: () => void;
}

export function EmailOtpForm({ email, alreadySent, onVerified }: Props) {
  const [typedEmail, setTypedEmail] = useState("");
  const address = email ?? typedEmail;

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(alreadySent ? RESEND_COOLDOWN : 0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = useCallback(
    async (value: string) => {
      if (!address) {
        setError("Indiquez votre adresse email.");
        return;
      }
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        await auth.verifyEmailOtp(address, value);
        onVerified();
      } catch (e) {
        setError(errorMessage(e, "Code incorrect ou expiré."));
        // Le code est consommé côté serveur, valide ou non : le laisser
        // affiché inviterait à re-soumettre le même en boucle.
        setCode("");
        inputRef.current?.focus();
      } finally {
        setBusy(false);
      }
    },
    [address, onVerified],
  );

  function onChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    setError(null);
    // Soumission automatique au 6e chiffre : demander un clic de plus
    // après avoir recopié un code n'apporte rien.
    if (digits.length === CODE_LENGTH) submit(digits);
  }

  async function resend() {
    if (!address) {
      setError("Indiquez votre adresse email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await auth.sendEmailOtp(address);
      setCooldown(RESEND_COOLDOWN);
      setNotice(`Nouveau code envoyé à ${address}.`);
    } catch (e) {
      setError(errorMessage(e, "Envoi impossible"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {email ? (
        <p className="text-sm text-ink-soft">
          Nous avons envoyé un code à 6 chiffres à{" "}
          <span className="font-semibold text-ink">{email}</span>. Saisissez-le
          ci-dessous — cette page reste ouverte.
        </p>
      ) : (
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">
            Votre adresse email
          </span>
          <input
            type="email"
            value={typedEmail}
            onChange={(e) => setTypedEmail(e.target.value)}
            placeholder="vous@exemple.fr"
            className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none transition focus:border-signal"
          />
        </label>
      )}

      <div>
        <label
          htmlFor="otp-code"
          className="mb-1.5 block text-sm font-semibold text-ink-soft"
        >
          Code de vérification
        </label>
        <input
          id="otp-code"
          ref={inputRef}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          disabled={busy}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          placeholder="––––––"
          aria-describedby={error ? "otp-error" : undefined}
          className="h-14 w-full max-w-[280px] rounded-xl border-2 border-line bg-paper text-center font-mono text-2xl font-black tracking-[0.5em] text-ink outline-none transition focus:border-signal disabled:opacity-60"
        />
      </div>

      {error && (
        <p
          id="otp-error"
          role="alert"
          className="rounded-lg bg-signal-light px-3 py-2 text-sm font-semibold text-signal-dark"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm font-semibold text-ok">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => submit(code)}
          disabled={busy || code.length < CODE_LENGTH}
          className="rounded-full bg-signal px-6 py-3 text-sm font-bold text-white transition hover:bg-signal-dark disabled:opacity-40"
        >
          {busy ? "Vérification…" : "Valider"}
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={busy || cooldown > 0}
          className="text-sm font-semibold text-signal transition hover:underline disabled:text-ink-muted disabled:no-underline"
        >
          {cooldown > 0 ? `Renvoyer le code (${cooldown} s)` : "Renvoyer le code"}
        </button>
      </div>

      <p className="text-xs text-ink-muted">
        Le code expire au bout de 10 minutes. Pensez à regarder dans vos
        courriers indésirables.
      </p>
    </div>
  );
}
