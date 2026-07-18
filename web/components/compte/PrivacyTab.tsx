"use client";

import Link from "next/link";
import { useState } from "react";
import { accountApi } from "@/lib/auth";

export function PrivacyTab({ onDeleted }: { onDeleted: () => void }) {
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadExport() {
    setExporting(true);
    try {
      const data = await accountApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mes-donnees-tvp-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur export");
    } finally {
      setExporting(false);
    }
  }

  async function confirmDelete() {
    setError(null); setDeleteBusy(true);
    try {
      const { reauth_token } = await accountApi.reauth(pwd);
      await accountApi.deleteAccount(reauth_token);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-paper p-6 shadow-card">
        <h2 className="mb-1 font-display text-lg font-black text-ink">Exporter mes données</h2>
        <p className="text-sm text-ink-muted">
          Téléchargez l&apos;intégralité des données associées à votre compte (RGPD art. 20 — droit à la portabilité).
          Format JSON.
        </p>
        <button
          onClick={downloadExport}
          disabled={exporting}
          className="mt-4 rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-paper hover:bg-signal disabled:opacity-60"
        >
          {exporting ? "Préparation…" : "⬇ Télécharger mes données"}
        </button>
      </section>

      <section className="rounded-2xl border border-signal/30 bg-signal-light p-6">
        <h2 className="mb-1 font-display text-lg font-black text-signal-dark">Supprimer mon compte</h2>
        <p className="text-sm text-signal-dark">
          Action <strong>irréversible</strong>. Vos données personnelles seront anonymisées.
          Les factures et données comptables sont conservées 10 ans (obligation légale).
        </p>
        {error && (
          <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-xs text-signal-dark">{error}</p>
        )}
        {!deleteOpen ? (
          <button
            onClick={() => setDeleteOpen(true)}
            className="mt-4 rounded-lg border border-signal px-5 py-2.5 text-sm font-bold text-signal hover:bg-signal hover:text-white"
          >
            Supprimer mon compte
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-bold text-signal-dark">Confirmez avec votre mot de passe :</p>
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Mot de passe actuel"
              autoComplete="current-password"
              className="h-11 w-full rounded-lg border border-signal/40 bg-paper px-3 outline-none focus:border-signal"
            />
            <div className="flex gap-2">
              <button
                onClick={confirmDelete}
                disabled={!pwd || deleteBusy}
                className="rounded-lg bg-signal px-5 py-2.5 text-sm font-bold text-white hover:bg-signal-dark disabled:opacity-60"
              >
                {deleteBusy ? "Suppression…" : "Confirmer la suppression"}
              </button>
              <button
                onClick={() => { setDeleteOpen(false); setPwd(""); setError(null); }}
                className="rounded-lg border border-line bg-paper px-5 py-2.5 text-sm font-semibold text-ink-soft hover:border-signal"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="text-center text-xs text-ink-muted">
        En savoir plus sur l&apos;utilisation de vos données :{" "}
        <Link href="/confidentialite" className="text-signal hover:underline">
          Politique de confidentialité
        </Link>
      </p>
    </div>
  );
}
