"use client";

import { useState } from "react";
import { accountApi, type Address } from "@/lib/auth";
import { SkeletonList } from "@/components/Skeleton";

const EMPTY_FORM = {
  label: "", line1: "", line2: "", postal_code: "", city: "", country: "FR", is_default: false,
};

export function AddressesTab({
  addresses, setAddresses,
}: { addresses: Address[] | null; setAddresses: (a: Address[] | ((p: Address[] | null) => Address[])) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() { setEditId(null); setForm({ ...EMPTY_FORM }); setError(null); setShowForm(true); }
  function openEdit(a: Address) {
    setShowForm(false); setEditId(a.id);
    setForm({
      label: a.label ?? "", line1: a.line1, line2: a.line2 ?? "",
      postal_code: a.postal_code, city: a.city, country: a.country, is_default: a.is_default,
    });
    setError(null);
  }
  function cancel() { setShowForm(false); setEditId(null); setError(null); }

  function validate(): string | null {
    if (form.line1.trim().length < 5) return "L'adresse doit contenir au moins 5 caractères.";
    if (form.country === "FR" && !/^\d{5}$/.test(form.postal_code.trim()))
      return "Le code postal doit contenir 5 chiffres.";
    if (form.city.trim().length < 2) return "Ville requise.";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate(); if (v) { setError(v); return; }
    setSaving(true); setError(null);
    try {
      const payload = { ...form, label: form.label || null, line2: form.line2 || null };
      const updated = editId
        ? await accountApi.updateAddress(editId, payload)
        : await accountApi.addAddress(payload);
      setAddresses((prev) => {
        const list = prev ? [...prev] : [];
        if (editId) {
          return list.map((a) => {
            if (payload.is_default && a.id !== editId) return { ...a, is_default: false };
            return a.id === editId ? updated : a;
          });
        }
        if (payload.is_default) return [...list.map((a) => ({ ...a, is_default: false })), updated];
        return [...list, updated];
      });
      cancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(id: string) {
    try {
      await accountApi.setDefaultAddress(id);
      setAddresses((prev) => prev ? prev.map((a) => ({ ...a, is_default: a.id === id })) : []);
    } catch {}
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cette adresse ?")) return;
    try {
      await accountApi.deleteAddress(id);
      setAddresses((prev) => prev ? prev.filter((a) => a.id !== id) : []);
      if (editId === id) cancel();
    } catch {}
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-black text-ink">Mes adresses</h2>
        {!showForm && !editId && (
          <button onClick={openAdd} className="rounded-full bg-signal px-4 py-2 text-sm font-bold text-white hover:bg-signal-dark">
            + Ajouter
          </button>
        )}
      </div>

      {(showForm || editId) && (
        <form onSubmit={submit} className="mb-6 rounded-2xl border border-signal/30 bg-paper p-6 shadow-card">
          <p className="mb-4 font-display font-bold text-ink">
            {editId ? "Modifier l'adresse" : "Nouvelle adresse"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Libellé" placeholder="Domicile, Bureau…" value={form.label} onChange={(v) => setForm({ ...form, label: v })} />
            <Input label="Adresse *" placeholder="12 rue de la Paix" value={form.line1} onChange={(v) => setForm({ ...form, line1: v })} />
            <Input label="Complément" placeholder="Apt, bât…" value={form.line2} onChange={(v) => setForm({ ...form, line2: v })} />
            <Input label="Code postal *" placeholder="75001" value={form.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} />
            <Input label="Ville *" placeholder="Paris" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-muted">Pays</label>
              <select
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-signal"
              >
                <option value="FR">France</option>
                <option value="BE">Belgique</option>
                <option value="CH">Suisse</option>
                <option value="LU">Luxembourg</option>
              </select>
            </div>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              className="accent-signal"
            />
            Définir comme adresse par défaut
          </label>
          {error && <p className="mt-3 rounded-lg bg-signal-light px-3 py-2 text-xs text-signal-dark">{error}</p>}
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={saving}
              className="rounded-full bg-signal px-5 py-2 text-sm font-bold text-white hover:bg-signal-dark disabled:opacity-50">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" onClick={cancel}
              className="rounded-full border border-line px-5 py-2 text-sm font-semibold text-ink-soft hover:border-signal hover:text-signal">
              Annuler
            </button>
          </div>
        </form>
      )}

      {addresses === null ? (
        <SkeletonList count={2} itemClass="h-32" />
      ) : addresses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper p-10 text-center">
          <p className="text-4xl">📍</p>
          <p className="mt-3 text-ink-muted">Aucune adresse enregistrée.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className={`rounded-2xl border bg-paper p-5 shadow-card transition ${
              a.is_default ? "border-signal/50" : "border-line"
            } ${editId === a.id ? "ring-2 ring-signal/30" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                {a.label && <p className="font-display font-bold text-ink">{a.label}</p>}
                {a.is_default && <span className="rounded-full bg-signal/10 px-2 py-0.5 text-xs font-bold text-signal">Par défaut</span>}
              </div>
              <p className="mt-2 text-sm text-ink-soft">
                {a.line1}
                {a.line2 && <><br />{a.line2}</>}
                <br />{a.postal_code} {a.city}<br />{a.country}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {!a.is_default && (
                  <button onClick={() => setDefault(a.id)}
                    className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-soft hover:border-signal hover:text-signal">
                    Par défaut
                  </button>
                )}
                <button onClick={() => openEdit(a)}
                  className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-soft hover:border-signal hover:text-signal">
                  Modifier
                </button>
                <button onClick={() => remove(a.id)}
                  className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-soft hover:border-signal hover:text-signal">
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Input({
  label, placeholder, value, onChange,
}: { label: string; placeholder?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-ink-muted">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-signal"
      />
    </div>
  );
}
