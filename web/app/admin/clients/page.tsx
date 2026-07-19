"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, type AdminCustomer } from "@/lib/admin";
import { formatEuro } from "@/lib/money";

const PER_PAGE = 25;

const SORTS = [
  { value: "recent", label: "Inscription récente" },
  { value: "revenue", label: "Chiffre d'affaires" },
  { value: "orders", label: "Nombre de commandes" },
  { value: "last_order", label: "Dernière commande" },
  { value: "name", label: "Nom" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AdminCustomers() {
  const [rows, setRows] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [accountType, setAccountType] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (q: string, type: string, s: string, p: number) => {
      setLoading(true);
      setError(null);
      try {
        setRows(
          await adminApi.listCustomers({
            q: q || undefined,
            account_type: type || undefined,
            sort: s,
            page: p,
          }),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(search, accountType, sort, page);
    // Le champ de recherche a son propre debounce, d'où son absence ici.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountType, sort, page, load]);

  function onSearch(val: string) {
    setSearch(val);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => load(val, accountType, sort, 1),
      350,
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-black text-ink">Clients</h1>
        <p className="text-sm text-ink-muted">
          {rows.length} client{rows.length > 1 ? "s" : ""} affiché
          {rows.length > 1 ? "s" : ""}
        </p>
      </div>

      {/* Filtres */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Rechercher : email, nom, société…"
          aria-label="Rechercher un client"
          className="h-10 min-w-[240px] flex-1 rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none transition focus:border-signal"
        />
        <select
          value={accountType}
          onChange={(e) => {
            setAccountType(e.target.value);
            setPage(1);
          }}
          aria-label="Type de compte"
          className="h-10 rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none transition focus:border-signal"
        >
          <option value="">Tous les types</option>
          <option value="particulier">Particuliers</option>
          <option value="pro">Professionnels</option>
        </select>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          aria-label="Trier par"
          className="h-10 rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none transition focus:border-signal"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              Trier : {s.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-signal-light px-4 py-3 text-sm text-signal-dark">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-paper p-10 text-center">
          <p className="font-semibold text-ink">Aucun client</p>
          <p className="mt-1 text-sm text-ink-muted">
            {search || accountType
              ? "Aucun résultat pour ces critères."
              : "Les comptes créés sur le site apparaîtront ici."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper shadow-card">
          <table className="w-full min-w-[840px] text-sm">
            <thead className="border-b border-line text-xs font-bold uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Commandes</th>
                <th className="px-4 py-3 text-right">CA TTC</th>
                <th className="px-4 py-3 text-left">Dernière</th>
                <th className="px-4 py-3 text-left">Inscrit le</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-line last:border-0 transition hover:bg-paper-dim"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">
                        {c.name ?? "—"}
                      </span>
                      {!c.email_verified && (
                        <span
                          title="Adresse email non vérifiée"
                          className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800"
                        >
                          non vérifié
                        </span>
                      )}
                      {c.role === "admin" && (
                        <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">
                          admin
                        </span>
                      )}
                    </div>
                    <a
                      href={`mailto:${c.email}`}
                      className="text-xs text-ink-muted hover:text-signal"
                    >
                      {c.email}
                    </a>
                    {c.phone && (
                      <span className="ml-2 text-xs text-ink-muted">
                        {c.phone}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.account_type === "pro" ? (
                      <div>
                        <span className="rounded-full bg-signal-light px-2 py-0.5 text-[11px] font-bold text-signal-dark">
                          PRO
                        </span>
                        {c.company_name && (
                          <p className="mt-1 text-xs text-ink-muted">
                            {c.company_name}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-ink-muted">
                        Particulier
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-ink">
                    {c.orders_count}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-ink">
                    {c.revenue_ttc > 0 ? formatEuro(c.revenue_ttc) : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {formatDate(c.last_order_at)}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {formatDate(c.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {/* La liste commandes filtre déjà par email : on réutilise
                        plutôt que de créer une fiche client dédiée. */}
                    <Link
                      href={`/admin/commandes?q=${encodeURIComponent(c.email)}`}
                      className="whitespace-nowrap text-xs font-semibold text-signal hover:underline"
                    >
                      Ses commandes →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination : l'API ne renvoie pas de total, on se cale sur le
          remplissage de la page comme la liste commandes. */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1 || loading}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal disabled:opacity-40"
        >
          ← Précédent
        </button>
        <span className="text-sm text-ink-muted">Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={rows.length < PER_PAGE || loading}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal disabled:opacity-40"
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
