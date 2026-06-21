"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import {
  accountApi,
  clearTokens,
  useCurrentUser,
  type Address,
  type OrderSummary,
} from "@/lib/auth";
import { clearCartSession } from "@/lib/cart";
import { PageSkeleton, SkeletonList } from "@/components/Skeleton";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "En attente de paiement",
  paid: "Payée",
  sent_to_supplier: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
  refunded: "Remboursée",
};

const STATUS_COLOR: Record<string, string> = {
  pending_payment: "bg-paper-dim text-ink-soft border-line",
  paid: "bg-ok/10 text-ok border-ok/30",
  sent_to_supplier: "bg-blue-50 text-blue-700 border-blue-200",
  shipped: "bg-amber-50 text-amber-700 border-amber-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-signal-light text-signal-dark border-signal/30",
  refunded: "bg-purple-50 text-purple-700 border-purple-200",
};

type Tab = "overview" | "orders" | "addresses" | "security" | "privacy";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Vue d'ensemble", icon: "▦" },
  { id: "orders", label: "Mes commandes", icon: "🛒" },
  { id: "addresses", label: "Adresses", icon: "📍" },
  { id: "security", label: "Sécurité", icon: "🔐" },
  { id: "privacy", label: "Mes données", icon: "🛡" },
];

export default function AccountPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialTab = (sp.get("tab") as Tab) || "overview";
  const { user, loading } = useCurrentUser();
  const [tab, setTab] = useState<Tab>(initialTab);

  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [addresses, setAddresses] = useState<Address[] | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    accountApi.listOrders().then(setOrders).catch(() => setOrders([]));
    accountApi.listAddresses().then(setAddresses).catch(() => setAddresses([]));
  }, [user]);

  function changeTab(t: Tab) {
    setTab(t);
    const params = new URLSearchParams(sp.toString());
    if (t === "overview") params.delete("tab"); else params.set("tab", t);
    router.replace(`/compte${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  function logout() {
    clearTokens();
    clearCartSession();
    router.push("/");
  }

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <PageSkeleton />
        </main>
      </>
    );
  }
  if (!user) return null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-signal">Mon compte</p>
            <h1 className="mt-1 font-display text-3xl font-black tracking-tightest text-ink">
              {user.first_name ? `Bonjour, ${user.first_name}` : "Bonjour"}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:border-signal hover:text-signal"
          >
            ⎋ Se déconnecter
          </button>
        </div>

        {/* Onglets */}
        <nav className="mb-8 flex flex-wrap gap-1 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => changeTab(t.id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                tab === t.id
                  ? "border-signal text-signal"
                  : "border-transparent text-ink-soft hover:text-ink"
              }`}
              aria-current={tab === t.id ? "page" : undefined}
            >
              <span aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {tab === "overview" && <OverviewTab user={user} orders={orders} addresses={addresses} onTabChange={changeTab} />}
        {tab === "orders" && <OrdersTab orders={orders} />}
        {tab === "addresses" && <AddressesTab addresses={addresses} setAddresses={setAddresses} />}
        {tab === "security" && <SecurityTab user={user} />}
        {tab === "privacy" && <PrivacyTab onDeleted={logout} />}
      </main>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// VUE D'ENSEMBLE
// ─────────────────────────────────────────────────────────────────

function OverviewTab({
  user, orders, addresses, onTabChange,
}: {
  user: { account_type: string };
  orders: OrderSummary[] | null;
  addresses: Address[] | null;
  onTabChange: (t: Tab) => void;
}) {
  const PAID = ["paid", "sent_to_supplier", "shipped", "delivered"];
  const totalSpent = orders?.filter((o) => PAID.includes(o.status))
    .reduce((s, o) => s + o.total_ttc, 0) ?? 0;
  const orderCount = orders?.length ?? 0;
  const inProgressCount = orders?.filter((o) =>
    ["paid", "sent_to_supplier", "shipped"].includes(o.status)).length ?? 0;
  const lastOrder = orders?.[0];

  return (
    <div className="space-y-8">
      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Commandes passées" value={orderCount.toString()} />
        <Kpi
          label="Total dépensé"
          value={`${totalSpent.toFixed(2).replace(".", ",")} €`}
          hint={user.account_type === "pro" ? "HT" : "TTC"}
        />
        <Kpi label="En cours" value={inProgressCount.toString()} />
      </div>

      {/* Dernière commande */}
      {lastOrder && (
        <section className="rounded-2xl border border-line bg-paper p-6 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-black text-ink">Dernière commande</h2>
            <button
              onClick={() => onTabChange("orders")}
              className="text-sm font-semibold text-signal hover:underline"
            >
              Voir toutes →
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
            <div>
              <p className="font-mono font-bold text-ink">{lastOrder.order_number}</p>
              <p className="text-xs text-ink-muted">
                {new Date(lastOrder.created_at).toLocaleDateString("fr-FR", {
                  day: "2-digit", month: "long", year: "numeric",
                })}
              </p>
            </div>
            <StatusBadge status={lastOrder.status} />
            <p className="font-display text-lg font-black text-ink">
              {lastOrder.total_ttc.toFixed(2).replace(".", ",")} €
            </p>
            <Link
              href={`/commandes/${lastOrder.order_number}`}
              className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper hover:bg-signal"
            >
              Détail
            </Link>
          </div>
        </section>
      )}

      {/* Raccourcis */}
      <section>
        <h2 className="mb-3 font-display text-lg font-black text-ink">Raccourcis</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/recherche"
            className="rounded-xl border border-line bg-paper p-5 transition hover:border-signal hover:shadow-lift"
          >
            <p className="font-display text-base font-bold text-ink">Nouvelle commande</p>
            <p className="mt-1 text-xs text-ink-muted">Rechercher des pneus →</p>
          </Link>
          <button
            onClick={() => onTabChange("addresses")}
            className="rounded-xl border border-line bg-paper p-5 text-left transition hover:border-signal hover:shadow-lift"
          >
            <p className="font-display text-base font-bold text-ink">
              {addresses?.length ?? 0} adresse{(addresses?.length ?? 0) > 1 ? "s" : ""}
            </p>
            <p className="mt-1 text-xs text-ink-muted">Gérer mes adresses →</p>
          </button>
          <button
            onClick={() => onTabChange("security")}
            className="rounded-xl border border-line bg-paper p-5 text-left transition hover:border-signal hover:shadow-lift"
          >
            <p className="font-display text-base font-bold text-ink">Sécurité</p>
            <p className="mt-1 text-xs text-ink-muted">Mot de passe, email →</p>
          </button>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-5 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-black text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLOR[status] ?? "bg-paper-dim text-ink-soft border-line";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// COMMANDES
// ─────────────────────────────────────────────────────────────────

function OrdersTab({ orders }: { orders: OrderSummary[] | null }) {
  const [filter, setFilter] = useState<string>("");

  if (orders === null) return <SkeletonList count={3} itemClass="h-24" />;

  const filtered = filter ? orders.filter((o) => o.status === filter) : orders;
  const statusesPresent = Array.from(new Set(orders.map((o) => o.status)));

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-paper p-10 text-center shadow-card">
        <p className="text-4xl">🛒</p>
        <p className="mt-3 text-ink-muted">Aucune commande pour l&apos;instant.</p>
        <Link
          href="/recherche"
          className="mt-4 inline-block rounded-full bg-signal px-6 py-3 text-sm font-bold text-white hover:bg-signal-dark"
        >
          Rechercher des pneus
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Filtres statut */}
      {statusesPresent.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("")}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              !filter ? "border-signal bg-signal text-white" : "border-line text-ink-soft hover:border-signal hover:text-signal"
            }`}
          >
            Toutes ({orders.length})
          </button>
          {statusesPresent.map((s) => {
            const count = orders.filter((o) => o.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  filter === s ? "border-signal bg-signal text-white" : "border-line text-ink-soft hover:border-signal hover:text-signal"
                }`}
              >
                {STATUS_LABEL[s]} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Desktop : tableau */}
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-paper shadow-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-paper-dim">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-muted">N° commande</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-muted">Date</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-muted">Articles</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-muted">Statut</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-ink-muted">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.order_number} className="border-t border-line hover:bg-paper-dim">
                <td className="px-4 py-3 font-mono font-bold text-ink">{o.order_number}</td>
                <td className="px-4 py-3 text-ink-soft">
                  {new Date(o.created_at).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {o.item_count} pneu{o.item_count > 1 ? "s" : ""}
                </td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3 text-right font-display font-black text-ink">
                  {o.total_ttc.toFixed(2).replace(".", ",")} €
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/commandes/${o.order_number}`}
                    className="text-sm font-semibold text-signal hover:underline"
                  >
                    Détail →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile : cartes */}
      <ul className="space-y-3 md:hidden">
        {filtered.map((o) => (
          <li key={o.order_number} className="rounded-xl border border-line bg-paper p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono font-bold text-ink">{o.order_number}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {new Date(o.created_at).toLocaleDateString("fr-FR")} · {o.item_count} pneu{o.item_count > 1 ? "s" : ""}
                </p>
              </div>
              <StatusBadge status={o.status} />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <p className="font-display text-lg font-black text-ink">
                {o.total_ttc.toFixed(2).replace(".", ",")} €
              </p>
              <Link
                href={`/commandes/${o.order_number}`}
                className="text-sm font-semibold text-signal"
              >
                Voir →
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ADRESSES (extrait original simplifié)
// ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  label: "", line1: "", line2: "", postal_code: "", city: "", country: "FR", is_default: false,
};

function AddressesTab({
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

// ─────────────────────────────────────────────────────────────────
// SÉCURITÉ
// ─────────────────────────────────────────────────────────────────

function SecurityTab({ user }: { user: { email: string } }) {
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pwdBusy, setPwdBusy] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  async function changePwd(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (newPwd !== newPwd2) { setPwdMsg({ tone: "err", text: "Les mots de passe ne correspondent pas" }); return; }
    setPwdBusy(true);
    try {
      await accountApi.changePassword(oldPwd, newPwd);
      setPwdMsg({ tone: "ok", text: "Mot de passe modifié avec succès" });
      setOldPwd(""); setNewPwd(""); setNewPwd2("");
    } catch (e) {
      setPwdMsg({ tone: "err", text: e instanceof Error ? e.message : "Erreur" });
    } finally { setPwdBusy(false); }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailMsg(null); setEmailBusy(true);
    try {
      await accountApi.requestEmailChange(newEmail);
      setEmailMsg({ tone: "ok", text: `Email de confirmation envoyé à ${newEmail}` });
      setNewEmail("");
    } catch (e) {
      setEmailMsg({ tone: "err", text: e instanceof Error ? e.message : "Erreur" });
    } finally { setEmailBusy(false); }
  }

  return (
    <div className="space-y-6">
      {/* Email */}
      <section className="rounded-2xl border border-line bg-paper p-6 shadow-card">
        <h2 className="mb-1 font-display text-lg font-black text-ink">Adresse email</h2>
        <p className="text-sm text-ink-muted">Actuelle : <strong className="text-ink">{user.email}</strong></p>
        {emailMsg && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            emailMsg.tone === "ok" ? "bg-ok/10 text-ok" : "bg-signal-light text-signal-dark"
          }`}>{emailMsg.text}</p>
        )}
        <form onSubmit={changeEmail} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="nouvelle.adresse@example.com"
            className="h-11 flex-1 rounded-lg border border-line bg-paper px-3 outline-none focus:border-signal"
          />
          <button
            type="submit"
            disabled={emailBusy}
            className="rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-paper hover:bg-signal disabled:opacity-60"
          >
            {emailBusy ? "Envoi…" : "Changer mon email"}
          </button>
        </form>
        <p className="mt-2 text-xs text-ink-muted">
          Un lien de confirmation sera envoyé à la nouvelle adresse. L&apos;email n&apos;est pas changé tant que vous n&apos;avez pas cliqué dessus.
        </p>
      </section>

      {/* Mot de passe */}
      <section className="rounded-2xl border border-line bg-paper p-6 shadow-card">
        <h2 className="mb-1 font-display text-lg font-black text-ink">Mot de passe</h2>
        <p className="text-sm text-ink-muted">Choisissez un mot de passe robuste, jamais utilisé ailleurs.</p>
        {pwdMsg && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            pwdMsg.tone === "ok" ? "bg-ok/10 text-ok" : "bg-signal-light text-signal-dark"
          }`}>{pwdMsg.text}</p>
        )}
        <form onSubmit={changePwd} className="mt-4 space-y-3">
          <PwdInput label="Mot de passe actuel" value={oldPwd} onChange={setOldPwd} autoComplete="current-password" />
          <PwdInput label="Nouveau mot de passe" value={newPwd} onChange={setNewPwd} autoComplete="new-password" />
          <PwdInput label="Confirmer" value={newPwd2} onChange={setNewPwd2} autoComplete="new-password" />
          <p className="text-xs text-ink-muted">
            Min. 10 caractères, 1 majuscule, 1 chiffre ou caractère spécial.
            Les mots de passe issus de fuites connues sont refusés.
          </p>
          <button
            type="submit"
            disabled={pwdBusy}
            className="rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-paper hover:bg-signal disabled:opacity-60"
          >
            {pwdBusy ? "Modification…" : "Modifier le mot de passe"}
          </button>
        </form>
      </section>
    </div>
  );
}

function PwdInput({
  label, value, onChange, autoComplete,
}: { label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</label>
      <input
        type="password"
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-line bg-paper px-3 outline-none focus:border-signal"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CONFIDENTIALITÉ / RGPD
// ─────────────────────────────────────────────────────────────────

function PrivacyTab({ onDeleted }: { onDeleted: () => void }) {
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
