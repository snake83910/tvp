"use client";

import { useState } from "react";
import type { Garage, GaragePayload } from "@/lib/partner";
import { Field, SaveButton, TabHeader } from "@/components/partner/ui";

export function CoordonneesTab({
  garage,
  save,
  saving,
}: {
  garage: Garage;
  save: (p: Partial<GaragePayload>) => Promise<void>;
  saving: boolean;
}) {
  const [f, setF] = useState({
    name: garage.name,
    address: garage.address,
    postal_code: garage.postal_code,
    city: garage.city,
    phone: garage.phone ?? "",
    email: garage.email ?? "",
    description: garage.description ?? "",
  });

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((p) => ({ ...p, [k]: v }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save({
          name: f.name.trim(),
          address: f.address.trim(),
          postal_code: f.postal_code.trim(),
          city: f.city.trim(),
          phone: f.phone.trim() || null,
          email: f.email.trim() || null,
          description: f.description.trim() || null,
        });
      }}
      className="max-w-xl space-y-3"
    >
      <TabHeader
        title="Coordonnées du centre"
        subtitle="Ces informations apparaissent sur votre page publique et au checkout."
      />
      <Field label="Nom du garage" value={f.name} onChange={(v) => set("name", v)} required />
      <Field label="Adresse" value={f.address} onChange={(v) => set("address", v)} required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code postal" value={f.postal_code} onChange={(v) => set("postal_code", v)} required />
        <Field label="Ville" value={f.city} onChange={(v) => set("city", v)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Téléphone" value={f.phone} onChange={(v) => set("phone", v)} />
        <Field label="Email" type="email" value={f.email} onChange={(v) => set("email", v)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-muted">
          Présentation
        </label>
        <textarea
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal"
        />
      </div>
      <SaveButton saving={saving} />
    </form>
  );
}
