"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

const BROWSER_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SetupData {
  secret: string;
  otpauth_url: string;
  qr_png_base64: string;
}

async function call(path: string, method = "GET", body?: object) {
  const token = getToken();
  const res = await fetch(`${BROWSER_API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = `Erreur ${res.status}`;
    try {
      const j = await res.json();
      if (j.detail) detail = j.detail;
    } catch {}
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export default function SecurityPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    call("/auth/2fa/status")
      .then((s) => setEnabled(s.enabled))
      .catch((e) => setError(e.message));
  }, []);

  async function startSetup() {
    setError(null); setInfo(null); setBusy(true);
    try {
      const data = await call("/auth/2fa/setup", "POST");
      setSetupData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    setError(null); setBusy(true);
    try {
      await call("/auth/2fa/enable", "POST", { code });
      setEnabled(true);
      setSetupData(null);
      setCode("");
      setInfo("2FA activé. Conservez l'app d'authentification : vous en aurez besoin à chaque connexion.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!confirm("Désactiver le 2FA ? Votre compte sera moins protégé.")) return;
    setError(null); setBusy(true);
    try {
      await call("/auth/2fa/disable", "POST", { code });
      setEnabled(false);
      setCode("");
      setInfo("2FA désactivé.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 font-display text-3xl font-black text-ink">Sécurité — 2FA</h1>
      <p className="mb-8 text-sm text-ink-muted">
        Double authentification par code à usage unique (TOTP). Compatible Google
        Authenticator, Microsoft Authenticator, Authy, 1Password.
      </p>

      {error && (
        <p className="mb-4 rounded-xl bg-signal-light px-4 py-3 text-sm text-signal-dark">{error}</p>
      )}
      {info && (
        <p className="mb-4 rounded-xl bg-ok/10 px-4 py-3 text-sm text-ok">{info}</p>
      )}

      {enabled === null && <p className="text-sm text-ink-muted">Chargement…</p>}

      {enabled === false && !setupData && (
        <div className="rounded-2xl border border-line bg-paper p-6 shadow-card">
          <p className="mb-1 text-sm font-bold text-ink">2FA désactivé</p>
          <p className="mb-4 text-sm text-ink-soft">
            Activez-le pour ajouter une couche de protection à votre compte admin.
          </p>
          <button
            onClick={startSetup}
            disabled={busy}
            className="rounded-full bg-signal px-5 py-2.5 text-sm font-bold text-white hover:bg-signal-dark disabled:opacity-60"
          >
            {busy ? "Préparation…" : "Activer le 2FA"}
          </button>
        </div>
      )}

      {enabled === false && setupData && (
        <div className="space-y-5 rounded-2xl border border-line bg-paper p-6 shadow-card">
          <div>
            <p className="mb-2 text-sm font-bold text-ink">1. Scannez ce QR code</p>
            <p className="mb-3 text-xs text-ink-muted">
              Avec votre app d&apos;authentification (Google Authenticator, etc.)
            </p>
            <img
              src={`data:image/png;base64,${setupData.qr_png_base64}`}
              alt="QR code 2FA"
              className="h-48 w-48 rounded-lg border border-line bg-paper-dim"
            />
          </div>
          <details className="text-xs text-ink-muted">
            <summary className="cursor-pointer">Saisie manuelle (sans QR code)</summary>
            <p className="mt-2 break-all rounded bg-paper-dim p-2 font-mono">
              {setupData.secret}
            </p>
          </details>

          <div>
            <p className="mb-2 text-sm font-bold text-ink">2. Entrez le code à 6 chiffres affiché par l&apos;app</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="h-12 w-40 rounded-lg border border-line bg-paper px-3 text-center font-mono text-lg tracking-widest outline-none focus:border-signal"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={confirmEnable}
              disabled={busy || code.length !== 6}
              className="rounded-full bg-signal px-5 py-2.5 text-sm font-bold text-white hover:bg-signal-dark disabled:opacity-60"
            >
              {busy ? "Vérification…" : "Activer"}
            </button>
            <button
              onClick={() => { setSetupData(null); setCode(""); }}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink-soft hover:border-signal"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {enabled === true && (
        <div className="rounded-2xl border border-ok/30 bg-ok/5 p-6 shadow-card">
          <p className="mb-1 text-sm font-bold text-ok">✓ 2FA activé</p>
          <p className="mb-4 text-sm text-ink-soft">
            Votre compte est protégé. Pour désactiver, entrez un code de votre app :
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="h-10 w-32 rounded-lg border border-line bg-paper px-3 text-center font-mono tracking-widest outline-none focus:border-signal"
            />
            <button
              onClick={disable}
              disabled={busy || code.length !== 6}
              className="rounded-full border border-signal px-4 py-2 text-sm font-semibold text-signal hover:bg-signal hover:text-white disabled:opacity-60"
            >
              {busy ? "…" : "Désactiver"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
