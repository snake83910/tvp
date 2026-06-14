"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "En attente de paiement",
  paid: "Payée",
  sent_to_supplier: "En cours de préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
  refunded: "Remboursée",
};

const STATUS_COLOR: Record<string, string> = {
  pending_payment: "bg-paper-dim text-ink-soft",
  paid: "bg-ok/10 text-ok",
  sent_to_supplier: "bg-ok/10 text-ok",
  shipped: "bg-ok/10 text-ok",
  delivered: "bg-ok/10 text-ok",
  cancelled: "bg-signal-light text-signal-dark",
  refunded: "bg-signal-light text-signal-dark",
};

const EMPTY_FORM = {
  label: "",
  line1: "",
  line2: "",
  postal_code: "",
  city: "",
  country: "FR",
  is_default: false,
};

export default function AccountPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  // ── Commandes ────────────────────────────────────────────────────
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // ── Adresses ─────────────────────────────────────────────────────
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [addrError, setAddrError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    accountApi.listOrders()
      .then(setOrders)
      .catch((e) => setOrdersError(e instanceof Error ? e.message : "Erreur chargement"));
    accountApi.listAddresses()
      .then(setAddresses)
      .catch((e) => setAddrError(e instanceof Error ? e.message : "Erreur chargement"));
  }, [user]);

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-6 py-16">
          <p className="text-ink-muted">Chargement…</p>
        </main>
      </>
    );
  }

  if (!user) return null;

  function logout() {
    clearTokens();
    clearCartSession();
    router.push("/");
  }

  // ── Helpers adresses ─────────────────────────────────────────────

  function openAdd() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setSaveError(null);
    setShowAddForm(true);
  }

  function openEdit(addr: Address) {
    setShowAddForm(false);
    setEditId(addr.id);
    setForm({
      label: addr.label ?? "",
      line1: addr.line1,
      line2: addr.line2 ?? "",
      postal_code: addr.postal_code,
      city: addr.city,
      country: addr.country,
      is_default: addr.is_default,
    });
    setSaveError(null);
  }

  function cancelForm() {
    setShowAddForm(false);
    setEditId(null);
    setSaveError(null);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        label: form.label || null,
        line1: form.line1,
        line2: form.line2 || null,
        postal_code: form.postal_code,
        city: form.city,
        country: form.country,
        is_default: form.is_default,
      };
      let updated: Address;
      if (editId) {
        updated = await accountApi.updateAddress(editId, payload);
        setAddresses((prev) =>
          prev ? prev.map((a) => {
            if (payload.is_default && a.id !== editId) return { ...a, is_default: false };
            return a.id === editId ? updated : a;
          }) : [updated]
        );
      } else {
        updated = await accountApi.addAddress(payload);
        setAddresses((prev) => {
          const list = prev ? [...prev] : [];
          if (payload.is_default) {
            return [...list.map((a) => ({ ...a, is_default: false })), updated];
          }
          return [...list, updated];
        });
      }
      cancelForm();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    try {
      const updated = await accountApi.setDefaultAddress(id);
      setAddresses((prev) =>
        prev
          ? prev.map((a) => ({
              ...a,
              is_default: a.id === id,
            }))
          : [updated]
      );
    } catch {
      // silently ignore, reload
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette adresse ?")) return;
    try {
      await accountApi.deleteAddress(id);
      setAddresses((prev) => (prev ? prev.filter((a) => a.id !== id) : []));
      if (editId === id) cancelForm();
    } catch (e) {
      setAddrError(e instanceof Error ? e.message : "Erreur suppression");
    }
  }

  const field = (
    key: keyof typeof form,
    label: string,
    opts?: { placeholder?: string; type?: string }
  ) => (
    <div>
      <label className="mb-1 block text-xs font-semibold text-ink-muted">
        {label}
      </label>
      <input
        type={opts?.type ?? "text"}
        placeholder={opts?.placeholder}
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-signal"
      />
    </div>
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-black tracking-tightest text-ink">
            Mon compte
          </h1>
          <button
            onClick={logout}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal"
          >
            Se déconnecter
          </button>
        </div>

        {/* Bloc identité */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card title="Identité">
            <p className="text-ink">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-sm text-ink-muted">{user.email}</p>
          </Card>
          <Card title="Type de compte">
            <p className="capitalize text-ink">{user.account_type}</p>
            <p className="text-sm text-ink-muted">Prix affichés TTC</p>
          </Card>
        </div>

        {/* ── Adresses de livraison ─────────────────────────────── */}
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-black tracking-tightest text-ink">
              Adresses de livraison
            </h2>
            {!showAddForm && !editId && (
              <button
                onClick={openAdd}
                className="rounded-full bg-signal px-4 py-2 text-sm font-bold text-white transition hover:bg-signal-dark"
              >
                + Ajouter
              </button>
            )}
          </div>

          {addrError && (
            <div className="mb-4 rounded-xl border border-signal/40 bg-signal-light p-4 text-sm text-signal-dark">
              {addrError}
            </div>
          )}

          {/* Formulaire ajout / édition */}
          {(showAddForm || editId) && (
            <form
              onSubmit={submitForm}
              className="mb-6 rounded-2xl border border-signal/30 bg-paper p-6 shadow-card"
            >
              <p className="mb-4 font-display font-bold text-ink">
                {editId ? "Modifier l'adresse" : "Nouvelle adresse"}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {field("label", "Libellé (optionnel)", { placeholder: "Ex : Domicile, Bureau…" })}
                {field("line1", "Adresse *", { placeholder: "12 rue de la Paix" })}
                {field("line2", "Complément", { placeholder: "Appartement, bâtiment…" })}
                {field("postal_code", "Code postal *", { placeholder: "75001" })}
                {field("city", "Ville *", { placeholder: "Paris" })}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-muted">
                    Pays
                  </label>
                  <select
                    value={form.country}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-signal"
                  >
                    <option value="FR">France</option>
                    <option value="BE">Belgique</option>
                    <option value="CH">Suisse</option>
                    <option value="LU">Luxembourg</option>
                  </select>
                </div>
              </div>
              <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
                  className="accent-signal"
                />
                Définir comme adresse par défaut
              </label>

              {saveError && (
                <p className="mt-3 rounded-lg bg-signal-light px-3 py-2 text-xs text-signal-dark">
                  {saveError}
                </p>
              )}

              <div className="mt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={saving || !form.line1 || !form.postal_code || !form.city}
                  className="rounded-full bg-signal px-5 py-2 text-sm font-bold text-white transition hover:bg-signal-dark disabled:opacity-50"
                >
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="rounded-full border border-line px-5 py-2 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          {/* Liste des adresses */}
          {addresses === null && !addrError && (
            <p className="text-sm text-ink-muted">Chargement…</p>
          )}

          {addresses && addresses.length === 0 && !showAddForm && (
            <div className="rounded-2xl border border-line bg-paper p-8 text-center shadow-card">
              <p className="text-ink-muted">Aucune adresse enregistrée.</p>
              <button
                onClick={openAdd}
                className="mt-4 rounded-full bg-signal px-6 py-2.5 text-sm font-bold text-white hover:bg-signal-dark"
              >
                Ajouter une adresse
              </button>
            </div>
          )}

          {addresses && addresses.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`rounded-2xl border bg-paper p-5 shadow-card transition ${
                    addr.is_default ? "border-signal/50" : "border-line"
                  } ${editId === addr.id ? "ring-2 ring-signal/30" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {addr.label && (
                          <p className="font-display font-bold text-ink">
                            {addr.label}
                          </p>
                        )}
                        {addr.is_default && (
                          <span className="rounded-full bg-signal/10 px-2 py-0.5 text-xs font-bold text-signal">
                            Par défaut
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-ink-soft">
                        {addr.line1}
                        {addr.line2 && <><br />{addr.line2}</>}
                        <br />
                        {addr.postal_code} {addr.city}
                        <br />
                        {addr.country}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {!addr.is_default && (
                      <button
                        onClick={() => handleSetDefault(addr.id)}
                        className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-soft transition hover:border-signal hover:text-signal"
                      >
                        Définir par défaut
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(addr)}
                      className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-soft transition hover:border-signal hover:text-signal"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(addr.id)}
                      className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-soft transition hover:border-signal/60 hover:text-signal"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Commandes ─────────────────────────────────────────── */}
        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl font-black tracking-tightest text-ink">
            Mes commandes
          </h2>

          {ordersError && (
            <div className="rounded-xl border border-signal/40 bg-signal-light p-4 text-sm text-signal-dark">
              {ordersError}
            </div>
          )}

          {orders === null && !ordersError && (
            <p className="text-ink-muted">Chargement…</p>
          )}

          {orders && orders.length === 0 && (
            <div className="rounded-2xl border border-line bg-paper p-10 text-center shadow-card">
              <p className="text-ink-muted">Aucune commande pour l&apos;instant.</p>
              <Link
                href="/recherche"
                className="mt-4 inline-block rounded-full bg-signal px-6 py-3 text-sm font-bold text-white hover:bg-signal-dark"
              >
                Rechercher des pneus
              </Link>
            </div>
          )}

          {orders && orders.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-paper-dim">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-muted">
                      N° commande
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-muted">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-muted">
                      Articles
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-muted">
                      Statut
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-ink-muted">
                      Total
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-ink-muted">
                      &nbsp;
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr
                      key={o.order_number}
                      className="border-t border-line hover:bg-paper-dim"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-ink">
                        {o.order_number}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {new Date(o.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {o.item_count} pneu{o.item_count > 1 ? "s" : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                            STATUS_COLOR[o.status] ?? "bg-paper-dim text-ink-soft"
                          }`}
                        >
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </td>
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
          )}
        </section>
      </main>
    </>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-paper p-6 shadow-card">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
        {title}
      </p>
      {children}
    </div>
  );
}
