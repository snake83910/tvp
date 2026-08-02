"use client";

import { useEffect, useState } from "react";
import { partnerApi, type Garage, type PartnerOrder } from "@/lib/partner";

type Tab = "page" | "commandes";

const STATUS_LABEL: Record<string, string> = {
  paid: "Payée",
  sent_to_supplier: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
};

type FormState = {
  name: string;
  address: string;
  postal_code: string;
  city: string;
  phone: string;
  email: string;
  mounting_price_eur: string;
  services: string;
  hours: string;
  description: string;
};

function toForm(g: Garage): FormState {
  return {
    name: g.name,
    address: g.address,
    postal_code: g.postal_code,
    city: g.city,
    phone: g.phone ?? "",
    email: g.email ?? "",
    mounting_price_eur: (g.mounting_price_cents / 100).toFixed(2),
    services: (g.services ?? []).join(", "),
    hours: (g.hours && g.hours.text) || "",
    description: g.description ?? "",
  };
}

export default function PartnerDashboard() {
  const [tab, setTab] = useState<Tab>("page");
  const [garage, setGarage] = useState<Garage | null>(null);
  const [orders, setOrders] = useState<PartnerOrder[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [noGarage, setNoGarage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const g = await partnerApi.getGarage();
        setGarage(g);
        setForm(toForm(g));
        setOrders(await partnerApi.listOrders());
      } catch {
        setNoGarage(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setMsg(null);
    try {
      const cents = Math.round(
        (parseFloat(form.mounting_price_eur.replace(",", ".")) || 0) * 100,
      );
      const g = await partnerApi.updateGarage({
        name: form.name.trim(),
        address: form.address.trim(),
        postal_code: form.postal_code.trim(),
        city: form.city.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        description: form.description.trim() || null,
        mounting_price_cents: cents,
        services: form.services.split(",").map((s) => s.trim()).filter(Boolean),
        hours: form.hours.trim() ? { text: form.hours.trim() } : {},
      });
      setGarage(g);
      setForm(toForm(g));
      setMsg("Page mise à jour.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-ink-muted">Chargement…</p>
      </main>
    );
  }

  if (noGarage) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="font-display text-2xl font-black text-ink">
          Espace partenaire
        </h1>
        <p className="mt-3 rounded-xl border border-line bg-paper p-6 text-ink-muted">
          Aucun garage n&apos;est encore rattaché à votre compte. Contactez
          l&apos;équipe tousvospneus.com pour finaliser votre inscription.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-2xl font-black text-ink">
        Espace partenaire — {garage?.name}
      </h1>

      <div className="mt-6 flex gap-2 border-b border-line">
        <TabButton active={tab === "page"} onClick={() => setTab("page")}>
          Ma page
        </TabButton>
        <TabButton active={tab === "commandes"} onClick={() => setTab("commandes")}>
          Mes commandes ({orders.length})
        </TabButton>
      </div>

      {tab === "page" && form && (
        <form onSubmit={save} className="mt-6 max-w-xl space-y-3">
          {garage && !garage.is_published && (
            <p className="rounded-lg bg-paper-dim p-3 text-xs text-ink-muted">
              Votre page n&apos;est pas encore publiée — elle le sera après
              validation par notre équipe.
            </p>
          )}
          <Field label="Nom du garage" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Field label="Adresse" value={form.address} onChange={(v) => setForm({ ...form, address: v })} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code postal" value={form.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} required />
            <Field label="Ville" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Téléphone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          </div>
          <Field
            label="Prix du montage / pneu (€ TTC, réglé sur place)"
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
              Présentation
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal"
            />
          </div>
          {msg && <p className="text-sm text-signal">{msg}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-signal px-6 py-2.5 text-sm font-bold text-white transition hover:bg-signal-dark disabled:opacity-60"
          >
            {saving ? "Enregistrement…" : "Enregistrer ma page"}
          </button>
        </form>
      )}

      {tab === "commandes" && (
        <div className="mt-6 space-y-4">
          {orders.length === 0 ? (
            <p className="rounded-xl border border-line bg-paper p-6 text-ink-muted">
              Aucune commande pour le moment. Les commandes des clients ayant
              choisi votre garage pour le montage apparaîtront ici.
            </p>
          ) : (
            orders.map((o) => (
              <div key={o.order_number} className="rounded-xl border border-line bg-paper p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-ink">
                    {o.order_number}
                  </span>
                  <span className="rounded-full bg-paper-dim px-3 py-0.5 text-xs font-bold text-ink-soft">
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {new Date(o.created_at).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>

                <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span>
                        <strong className="text-ink">{it.quantity}×</strong> {it.label}
                      </span>
                      {it.dimension && (
                        <span className="font-mono text-ink-muted">{it.dimension}</span>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="mt-3 border-t border-line pt-3 text-sm">
                  <p className="font-semibold text-ink">Client à contacter</p>
                  <p className="text-ink-soft">
                    {o.customer_name ?? "—"}
                    {o.customer_phone && ` · ${o.customer_phone}`}
                  </p>
                  {o.customer_email && (
                    <a href={`mailto:${o.customer_email}`} className="text-signal hover:underline">
                      {o.customer_email}
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border-signal text-signal"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
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
