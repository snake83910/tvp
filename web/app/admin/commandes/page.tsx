"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { adminApi, type AdminOrderSummary } from "@/lib/admin";
import { getToken } from "@/lib/auth";
import { STATUS_LABEL } from "@/lib/orderStatus";
import { OrderTable } from "@/components/admin/OrderTable";
import { SkeletonList } from "@/components/Skeleton";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";

const BROWSER_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STATUSES = [
  "paid", "sent_to_supplier", "shipped", "delivered",
  "pending_payment", "cancelled", "refunded",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoIso(d: number) {
  const t = new Date();
  t.setDate(t.getDate() - d);
  return t.toISOString().slice(0, 10);
}

export default function AdminOrders() {
  const sp = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState(sp.get("q") ?? "");
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [page, setPage] = useState(Number(sp.get("page") ?? 1));
  const [fromDate, setFromDate] = useState(sp.get("from_date") ?? "");
  const [toDate, setToDate] = useState(sp.get("to_date") ?? "");
  const [minAmount, setMinAmount] = useState(sp.get("min_amount") ?? "");
  const [maxAmount, setMaxAmount] = useState(sp.get("max_amount") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sélection en masse
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Confirmation bulk action
  const [confirmShip, setConfirmShip] = useState(false);
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  // Filtres sauvegardés (localStorage)
  const [savedViews, setSavedViews] = useState<{ name: string; qs: string }[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tvp_admin_views");
      if (raw) setSavedViews(JSON.parse(raw));
    } catch {}
  }, []);
  function saveCurrentView() {
    const name = prompt("Nom de la vue ?");
    if (!name) return;
    const qs = window.location.search.slice(1);
    const next = [...savedViews.filter((v) => v.name !== name), { name, qs }];
    setSavedViews(next);
    localStorage.setItem("tvp_admin_views", JSON.stringify(next));
    toast("Vue sauvegardée", "success");
  }
  function deleteView(name: string) {
    const next = savedViews.filter((v) => v.name !== name);
    setSavedViews(next);
    localStorage.setItem("tvp_admin_views", JSON.stringify(next));
  }

  async function sendBulkEmail() {
    if (!emailSubject || !emailBody) {
      toast("Sujet et message requis", "error");
      return;
    }
    setEmailSending(true);
    try {
      const r = await adminApi.bulkEmail(Array.from(selected), emailSubject, emailBody);
      toast(`Email envoyé à ${r.sent} destinataire${r.sent > 1 ? "s" : ""}`, "success");
      setBulkEmailOpen(false);
      setEmailSubject(""); setEmailBody("");
      setSelected(new Set());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setEmailSending(false);
    }
  }

  function fetch_(s: string, st: string, p: number, fd: string, td: string, minA: string, maxA: string) {
    setLoading(true);
    setError(null);
    adminApi
      .listOrders({
        q: s || undefined,
        status: st || undefined,
        page: p,
        from_date: fd || undefined,
        to_date: td || undefined,
        min_amount: minA ? parseFloat(minA) : undefined,
        max_amount: maxA ? parseFloat(maxA) : undefined,
      } as Parameters<typeof adminApi.listOrders>[0])
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));

    const params = new URLSearchParams();
    if (s) params.set("q", s);
    if (st) params.set("status", st);
    if (p > 1) params.set("page", String(p));
    if (fd) params.set("from_date", fd);
    if (td) params.set("to_date", td);
    if (minA) params.set("min_amount", minA);
    if (maxA) params.set("max_amount", maxA);
    router.replace(`/admin/commandes${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  useEffect(() => { fetch_(search, status, page, fromDate, toDate, minAmount, maxAmount); }, []); // eslint-disable-line

  function onSearch(val: string) {
    setSearch(val);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetch_(val, status, 1, fromDate, toDate, minAmount, maxAmount), 350);
  }

  function applyPeriod(from: string, to: string) {
    setFromDate(from); setToDate(to); setPage(1);
    fetch_(search, status, 1, from, to, minAmount, maxAmount);
  }

  function applyAmounts() {
    setPage(1);
    fetch_(search, status, 1, fromDate, toDate, minAmount, maxAmount);
  }

  const [exporting, setExporting] = useState(false);
  async function exportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      const url = `${BROWSER_API}/admin/orders/export.csv${params.size ? `?${params}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = `commandes-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(objectUrl);
      toast("Export CSV téléchargé", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur export", "error");
    } finally {
      setExporting(false);
    }
  }

  function toggleOne(orderNumber: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderNumber)) next.delete(orderNumber);
      else next.add(orderNumber);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => prev.size === orders.length ? new Set() : new Set(orders.map((o) => o.order_number)));
  }

  async function bulkShip() {
    const target = Array.from(selected);
    if (target.length === 0) return;
    let success = 0;
    let failed = 0;
    for (const orderNumber of target) {
      try {
        await adminApi.updateStatus(orderNumber, { status: "shipped" });
        success++;
      } catch {
        failed++;
      }
    }
    setSelected(new Set());
    fetch_(search, status, page, fromDate, toDate, minAmount, maxAmount);
    toast(
      `${success} expédiée${success > 1 ? "s" : ""}${failed ? ` · ${failed} en erreur` : ""}`,
      failed ? "error" : "success",
    );
  }

  // Périodes rapides
  const PERIODS = [
    { label: "Aujourd'hui", from: todayIso(), to: todayIso() },
    { label: "7 jours", from: daysAgoIso(6), to: todayIso() },
    { label: "30 jours", from: daysAgoIso(29), to: todayIso() },
    { label: "Mois", from: todayIso().slice(0, 8) + "01", to: todayIso() },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-display text-3xl font-black text-ink">Commandes</h1>
        <div className="flex flex-wrap items-end gap-2">
          <button
            onClick={saveCurrentView}
            className="h-9 rounded-lg border border-line bg-paper px-3 text-sm font-semibold text-ink-soft hover:border-signal hover:text-signal"
          >
            ☆ Sauver vue
          </button>
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="h-9 rounded-lg bg-ink px-4 text-sm font-bold text-paper transition hover:bg-signal disabled:opacity-60"
          >
            {exporting ? "Export…" : "Export CSV"}
          </button>
        </div>
      </div>

      {/* Vues sauvegardées */}
      {savedViews.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Mes vues :</span>
          {savedViews.map((v) => (
            <span key={v.name} className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-1 text-xs">
              <a href={`/admin/commandes?${v.qs}`} className="font-semibold text-ink hover:text-signal">{v.name}</a>
              <button onClick={() => deleteView(v.name)} className="text-ink-muted hover:text-signal" aria-label="Supprimer">×</button>
            </span>
          ))}
        </div>
      )}

      {/* Filtres période rapide */}
      <div className="mb-3 flex flex-wrap gap-2">
        {PERIODS.map((p) => {
          const active = fromDate === p.from && toDate === p.to;
          return (
            <button
              key={p.label}
              onClick={() => applyPeriod(p.from, p.to)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                active
                  ? "border-signal bg-signal text-white"
                  : "border-line text-ink-soft hover:border-signal hover:text-signal"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        {(fromDate || toDate || minAmount || maxAmount || status) && (
          <button
            onClick={() => {
              setStatus(""); setMinAmount(""); setMaxAmount("");
              applyPeriod("", "");
            }}
            className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-muted hover:border-signal hover:text-signal"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Filtres détaillés */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Recherche n° commande ou email…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-10 flex-1 rounded-lg border border-line bg-paper px-4 text-sm text-ink outline-none transition focus:border-signal"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); fetch_(search, e.target.value, 1, fromDate, toDate, minAmount, maxAmount); }}
          className="h-10 rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none transition focus:border-signal"
        >
          <option value="">Tous les statuts</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
          ))}
        </select>
        <input
          type="date" value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); applyPeriod(e.target.value, toDate); }}
          className="h-10 rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-signal"
        />
        <input
          type="date" value={toDate}
          onChange={(e) => { setToDate(e.target.value); applyPeriod(fromDate, e.target.value); }}
          className="h-10 rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-signal"
        />
        <input
          type="number" placeholder="Min €" value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
          onBlur={applyAmounts}
          className="h-10 w-24 rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-signal"
        />
        <input
          type="number" placeholder="Max €" value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          onBlur={applyAmounts}
          className="h-10 w-24 rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-signal"
        />
      </div>

      {/* Barre d'actions en masse */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-signal/30 bg-signal-light px-4 py-2.5 text-sm">
          <p className="font-semibold text-signal-dark">
            {selected.size} commande{selected.size > 1 ? "s" : ""} sélectionnée{selected.size > 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmShip(true)}
              className="rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-paper hover:bg-signal"
            >
              Marquer expédiées
            </button>
            <button
              onClick={() => setBulkEmailOpen(true)}
              className="rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-paper hover:bg-signal"
            >
              Envoyer email
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-signal hover:text-signal"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-xl bg-signal-light px-4 py-3 text-sm text-signal-dark">{error}</p>
      )}

      {loading ? (
        <SkeletonList count={5} itemClass="h-16" />
      ) : (
        <OrderTable
          orders={orders}
          selectable
          selected={selected}
          onToggle={toggleOne}
          onToggleAll={toggleAll}
        />
      )}

      {/* Pagination simple */}
      {!loading && orders.length > 0 && (
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetch_(search, status, p, fromDate, toDate, minAmount, maxAmount); }}
            disabled={page === 1}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft disabled:opacity-40 hover:border-signal hover:text-signal"
          >
            ← Précédent
          </button>
          <span className="flex items-center px-3 text-sm text-ink-muted">Page {page}</span>
          <button
            onClick={() => { const p = page + 1; setPage(p); fetch_(search, status, p, fromDate, toDate, minAmount, maxAmount); }}
            disabled={orders.length < 25}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft disabled:opacity-40 hover:border-signal hover:text-signal"
          >
            Suivant →
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmShip}
        title="Marquer comme expédiées"
        message={`${selected.size} commande${selected.size > 1 ? "s" : ""} vont passer au statut « expédiée ». Cette action déclenche l'envoi d'un email aux clients.`}
        confirmLabel="Confirmer"
        onClose={() => setConfirmShip(false)}
        onConfirm={bulkShip}
      />

      {/* Modal envoi email custom */}
      {bulkEmailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
          onClick={() => setBulkEmailOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-line bg-paper p-6 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-lg font-black text-ink">
              Email à {selected.size} client{selected.size > 1 ? "s" : ""}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Une seule copie par adresse email (dédupliqué).
            </p>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                placeholder="Sujet"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="h-10 w-full rounded-lg border border-line bg-paper px-3 outline-none focus:border-signal"
              />
              <textarea
                placeholder="Message…"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-signal"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setBulkEmailOpen(false)}
                className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:border-signal"
              >
                Annuler
              </button>
              <button
                onClick={sendBulkEmail}
                disabled={emailSending}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-paper hover:bg-signal disabled:opacity-60"
              >
                {emailSending ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
