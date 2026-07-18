"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth";
import { useToast } from "@/components/admin/Toast";

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "amount";
  discount_value: number;
  min_articles_ttc_cents: number;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  once_per_user: boolean;
  is_active: boolean;
  created_at: string;
  uses: number;
}

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await authFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.detail ?? `Erreur ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const EMPTY_FORM = {
  code: "",
  description: "",
  discount_type: "percent" as "percent" | "amount",
  discount_value: "",
  min_articles: "",
  valid_until: "",
  max_uses: "",
  once_per_user: false,
};

function fmtDiscount(p: PromoCode): string {
  return p.discount_type === "percent"
    ? `−${p.discount_value} %`
    : `−${(p.discount_value / 100).toFixed(2).replace(".", ",")} €`;
}

export default function AdminPromoPage() {
  const { toast } = useToast();
  const [promos, setPromos] = useState<PromoCode[] | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  function load() {
    api<PromoCode[]>("/admin/promo-codes")
      .then(setPromos)
      .catch((e) => toast(e.message, "error"));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => load(), []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const value =
        form.discount_type === "percent"
          ? parseInt(form.discount_value, 10)
          : Math.round(parseFloat(form.discount_value.replace(",", ".")) * 100);
      await api("/admin/promo-codes", "POST", {
        code: form.code,
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: value,
        min_articles_ttc_cents: form.min_articles
          ? Math.round(parseFloat(form.min_articles.replace(",", ".")) * 100)
          : 0,
        valid_until: form.valid_until
          ? new Date(`${form.valid_until}T23:59:59`).toISOString()
          : null,
        max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
        once_per_user: form.once_per_user,
      });
      toast(`Code ${form.code.toUpperCase()} créé`, "success");
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: PromoCode) {
    try {
      await api(`/admin/promo-codes/${p.id}`, "PATCH", {
        is_active: !p.is_active,
      });
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    }
  }

  async function remove(p: PromoCode) {
    if (!confirm(`Supprimer le code ${p.code} ? (les commandes déjà passées le conservent)`))
      return;
    try {
      await api(`/admin/promo-codes/${p.id}`, "DELETE");
      toast(`Code ${p.code} supprimé`, "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-black text-ink">Codes promo</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-full bg-signal px-4 py-2 text-sm font-bold text-white hover:bg-signal-dark"
        >
          {showForm ? "Fermer" : "+ Nouveau code"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={create}
          className="mb-8 grid gap-4 rounded-2xl border border-signal/30 bg-paper p-6 shadow-card sm:grid-cols-2 lg:grid-cols-3"
        >
          <Field label="Code *">
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="BIENVENUE10"
              className="h-11 w-full rounded-lg border border-line bg-paper px-3 font-mono text-sm uppercase outline-none focus:border-signal"
            />
          </Field>
          <Field label="Description">
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Offre de bienvenue"
              className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-signal"
            />
          </Field>
          <Field label="Type de remise *">
            <select
              value={form.discount_type}
              onChange={(e) =>
                setForm({ ...form, discount_type: e.target.value as "percent" | "amount" })
              }
              className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-signal"
            >
              <option value="percent">Pourcentage (%)</option>
              <option value="amount">Montant fixe (€)</option>
            </select>
          </Field>
          <Field label={form.discount_type === "percent" ? "Remise (%) *" : "Remise (€) *"}>
            <input
              required
              value={form.discount_value}
              onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
              placeholder={form.discount_type === "percent" ? "10" : "15,00"}
              className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-signal"
            />
          </Field>
          <Field label="Minimum d'articles (€)">
            <input
              value={form.min_articles}
              onChange={(e) => setForm({ ...form, min_articles: e.target.value })}
              placeholder="0"
              className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-signal"
            />
          </Field>
          <Field label="Valable jusqu'au">
            <input
              type="date"
              value={form.valid_until}
              onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
              className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-signal"
            />
          </Field>
          <Field label="Nombre max d'utilisations">
            <input
              value={form.max_uses}
              onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
              placeholder="Illimité"
              className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-signal"
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.once_per_user}
              onChange={(e) => setForm({ ...form, once_per_user: e.target.checked })}
              className="accent-signal"
            />
            Une seule fois par client
          </label>
          <div className="self-end">
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-signal px-5 py-2.5 text-sm font-bold text-white hover:bg-signal-dark disabled:opacity-50"
            >
              {busy ? "Création…" : "Créer le code"}
            </button>
          </div>
        </form>
      )}

      {promos === null ? (
        <p className="text-ink-muted">Chargement…</p>
      ) : promos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper p-10 text-center">
          <p className="text-ink-muted">
            Aucun code promo. Créez le premier avec « + Nouveau code ».
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-paper-dim">
              <tr>
                {["Code", "Remise", "Conditions", "Utilisations", "Statut", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="font-mono font-bold text-ink">{p.code}</p>
                    {p.description && (
                      <p className="text-xs text-ink-muted">{p.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-display font-black text-ink">
                    {fmtDiscount(p)}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    {p.min_articles_ttc_cents > 0 && (
                      <p>Min. {(p.min_articles_ttc_cents / 100).toFixed(2).replace(".", ",")} €</p>
                    )}
                    {p.valid_until && (
                      <p>Jusqu&apos;au {new Date(p.valid_until).toLocaleDateString("fr-FR")}</p>
                    )}
                    {p.once_per_user && <p>1 / client</p>}
                    {!p.min_articles_ttc_cents && !p.valid_until && !p.once_per_user && "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {p.uses}
                    {p.max_uses != null && ` / ${p.max_uses}`}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(p)}
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        p.is_active
                          ? "bg-ok/10 text-ok"
                          : "bg-paper-dim text-ink-muted"
                      }`}
                      title="Cliquer pour activer/désactiver"
                    >
                      {p.is_active ? "Actif" : "Inactif"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(p)}
                      className="text-xs font-semibold text-ink-muted hover:text-signal"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
