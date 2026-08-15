"use client";

import { useState } from "react";
import { partnerApi, mediaUrl, type Garage } from "@/lib/partner";
import { TabHeader } from "@/components/garage/ui";

export function MediaTab({
  garage,
  onChange,
}: {
  garage: Garage;
  onChange: (g: Garage) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await partnerApi.addPhoto(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'envoi");
    } finally {
      setBusy(false);
    }
  }

  async function remove(path: string) {
    setBusy(true);
    try {
      onChange(await partnerApi.removePhoto(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la suppression");
    } finally {
      setBusy(false);
    }
  }

  const photos = garage.photos ?? [];

  return (
    <div>
      <TabHeader
        title="Photos du centre"
        subtitle="Ajoutez des photos de votre garage — elles apparaissent sur votre page publique."
      />

      {error && <p className="mb-3 text-sm text-signal">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p) => (
          <div key={p} className="relative overflow-hidden rounded-xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(p)} alt="Photo du garage" className="h-32 w-full object-cover" />
            <button
              onClick={() => remove(p)}
              disabled={busy}
              className="absolute right-1.5 top-1.5 rounded-full bg-ink/70 px-2 py-0.5 text-xs font-bold text-white hover:bg-signal"
              aria-label="Supprimer la photo"
            >
              ✕
            </button>
          </div>
        ))}

        <label className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line text-sm text-ink-muted transition hover:border-signal hover:text-signal">
          <span className="text-2xl">＋</span>
          <span>{busy ? "Envoi…" : "Ajouter une photo"}</span>
          <input
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            disabled={busy}
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </label>
      </div>

      <p className="mt-3 text-xs text-ink-muted">JPG ou PNG, 5 Mo max par photo.</p>
    </div>
  );
}
