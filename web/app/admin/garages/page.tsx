"use client";

import { useEffect, useState } from "react";
import {
  adminApi,
  downloadGarageKbis,
  type Garage,
  type GaragePayload,
} from "@/lib/admin";
import { useToast } from "@/components/admin/Toast";
import { formatEuro } from "@/lib/money";

type FormState = {
  name: string;
  address: string;
  postal_code: string;
  city: string;
  phone: string;
  email: string;
  siret: string;
  mounting_price_eur: string;
  services: string;
  hours: string;
  description: string;
  is_published: boolean;
  owner_email: string;
};

const EMPTY: FormState = {
  name: "",
  address: "",
  postal_code: "",
  city: "",
  phone: "",
  email: "",
  siret: "",
  mounting_price_eur: "",
  services: "",
  hours: "",
  description: "",
  is_published: true,
  owner_email: "",
};

function toForm(g: Garage): FormState {
  return {
    name: g.name,
    address: g.address,
    postal_code: g.postal_code,
    city: g.city,
    phone: g.phone ?? "",
    email: g.email ?? "",
    siret: g.siret ?? "",
    mounting_price_eur: (g.mounting_price_cents / 100).toFixed(2),
    services: (g.services ?? []).join(", "),
    hours: (g.hours && g.hours.text) || "",
    description: g.description ?? "",
    is_published: g.is_published,
    owner_email: "",
  };
}

function toPayload(f: FormState): GaragePayload {
  const cents = Math.round((parseFloat(f.mounting_price_eur.replace(",", ".")) || 0) * 100);
  return {
    name: f.name.trim(),
    address: f.address.trim(),
    postal_code: f.postal_code.trim(),
    city: f.city.trim(),
    phone: f.phone.trim() || null,
    email: f.email.trim() || null,
    siret: f.siret.trim() || null,
    description: f.description.trim() || null,
    mounting_price_cents: cents,
    services: f.services
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    hours: f.hours.trim() ? { text: f.hours.trim() } : {},
    is_published: f.is_published,
  };
}

export default function AdminGaragesPage() {
  const { toast } = useToast();
  const [garages, setGarages] = useState<Garage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Garage | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setGarages(await adminApi.listGarages());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur de chargement", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    setEditing(null);
    setForm(EMPTY);
    setShowForm(true);
  }

  function startEdit(g: Garage) {
    setEditing(g);
    setForm(toForm(g));
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = toPayload(form);
      let garageId = editing?.id;
      if (editing) {
        await adminApi.updateGarage(editing.id, payload);
        toast("Garage mis à jour", "success");
      } else {
        const created = await adminApi.createGarage(payload);
        garageId = created.id;
        toast("Garage créé", "success");
      }
      const ownerEmail = form.owner_email.trim();
      if (ownerEmail && garageId) {
        await adminApi.setGarageOwner(garageId, ownerEmail);
        toast("Compte gérant rattaché", "success");
      }
      setShowForm(false);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Échec de l'enregistrement", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(g: Garage) {
    if (!confirm(`Supprimer le garage « ${g.name} » ?`)) return;
    try {
      await adminApi.deleteGarage(g.id);
      toast("Garage supprimé", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Échec de la suppression", "error");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">
            Garages partenaires
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Gérez les garages de montage proposés aux clients au checkout.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="rounded-lg bg-signal px-4 py-2 text-sm font-bold text-white transition hover:bg-signal-dark"
        >
          + Nouveau garage
        </button>
      </div>

      {loading ? (
        <p className="text-ink-muted">Chargement…</p>
      ) : garages.length === 0 ? (
        <div className="rounded-xl border border-line bg-paper p-8 text-center text-ink-muted">
          Aucun garage pour l&apos;instant. Créez le premier partenaire.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-muted">
                <th className="p-3">Nom</th>
                <th className="p-3">Ville</th>
                <th className="p-3">Montage / pneu</th>
                <th className="p-3">Géoloc.</th>
                <th className="p-3">Kbis</th>
                <th className="p-3">Publié</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {garages.map((g) => (
                <tr key={g.id} className="border-b border-line last:border-0">
                  <td className="p-3 font-semibold text-ink">{g.name}</td>
                  <td className="p-3 text-ink-soft">
                    {g.postal_code} {g.city}
                  </td>
                  <td className="p-3 text-ink-soft">
                    {formatEuro(g.mounting_price_cents / 100)}
                  </td>
                  <td className="p-3">
                    {g.lat != null && g.lng != null ? (
                      <span className="text-ok">✓ géocodé</span>
                    ) : (
                      <span className="text-signal">⚠ non géocodé</span>
                    )}
                  </td>
                  <td className="p-3">
                    {g.kbis_path ? (
                      <button
                        onClick={() => downloadGarageKbis(g.id, g.slug)}
                        className="font-semibold text-signal hover:underline"
                      >
                        ↓ voir
                      </button>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {g.is_published ? (
                      <span className="text-ok">Oui</span>
                    ) : (
                      <span className="text-ink-muted">Non</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => startEdit(g)}
                      className="mr-3 font-semibold text-signal hover:underline"
                    >
                      Éditer
                    </button>
                    <button
                      onClick={() => remove(g)}
                      className="font-semibold text-ink-muted hover:text-signal"
                    >
                      Suppr.
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setShowForm(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
            className="my-8 w-full max-w-lg rounded-2xl bg-paper p-6 shadow-lift"
          >
            <h2 className="mb-4 font-display text-lg font-black text-ink">
              {editing ? "Éditer le garage" : "Nouveau garage"}
            </h2>
            <div className="space-y-3">
              <Field label="Nom" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Adresse" required value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Code postal" required value={form.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} />
                <Field label="Ville" required value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Téléphone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Field label="SIRET" value={form.siret} onChange={(v) => setForm({ ...form, siret: v })} />
                </div>
                {editing?.kbis_path ? (
                  <button
                    type="button"
                    onClick={() => downloadGarageKbis(editing.id, editing.slug)}
                    className="mb-0.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-signal hover:border-signal"
                  >
                    ↓ Kbis
                  </button>
                ) : (
                  <span className="mb-2 text-xs text-ink-muted">Pas de Kbis</span>
                )}
              </div>
              {editing && (
                <div className="text-xs">
                  <p>
                    SIRET :{" "}
                    {editing.siret_verified ? (
                      <span className="font-semibold text-ok">✓ vérifié auprès de la base Sirene (actif)</span>
                    ) : (
                      <span className="font-semibold text-signal">⚠ non vérifié Sirene — à contrôler manuellement</span>
                    )}
                  </p>
                  {editing.siret_company_name && (
                    <p className="mt-0.5 text-ink-muted">
                      Raison sociale Sirene :{" "}
                      <span className="font-semibold text-ink">{editing.siret_company_name}</span>
                    </p>
                  )}
                </div>
              )}
              <Field
                label="Prix du montage / pneu (€ TTC)"
                type="number"
                value={form.mounting_price_eur}
                onChange={(v) => setForm({ ...form, mounting_price_eur: v })}
              />
              <Field
                label="Prestations (séparées par des virgules)"
                value={form.services}
                onChange={(v) => setForm({ ...form, services: v })}
                placeholder="équilibrage, valve, recyclage"
              />
              <Field
                label="Horaires"
                value={form.hours}
                onChange={(v) => setForm({ ...form, hours: v })}
                placeholder="Lun-Ven 8h-18h, Sam 9h-12h"
              />
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                  className="accent-signal"
                />
                Publié (visible au checkout)
              </label>

              <div className="rounded-lg border border-line bg-paper-dim p-3">
                <Field
                  label="Email du gérant (accès au portail partenaire)"
                  type="email"
                  value={form.owner_email}
                  onChange={(v) => setForm({ ...form, owner_email: v })}
                  placeholder="gerant@garage.fr"
                />
                <p className="mt-1 text-xs text-ink-muted">
                  {editing?.owner_user_id
                    ? "Un compte gérant est déjà rattaché. Saisir un email le remplace."
                    : "Rattache (ou crée) le compte qui gérera la page et verra les commandes. Un email d'accès est envoyé si le compte est créé."}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:border-signal"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-signal px-5 py-2 text-sm font-bold text-white transition hover:bg-signal-dark disabled:opacity-60"
              >
                {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Créer"}
              </button>
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              L&apos;adresse est géocodée automatiquement à l&apos;enregistrement
              pour le calcul du garage le plus proche.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal"
      />
    </div>
  );
}
