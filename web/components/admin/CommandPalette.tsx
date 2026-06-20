"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { adminApi, type AdminOrderSummary } from "@/lib/admin";

interface Action {
  label: string;
  hint?: string;
  run: () => void;
}

const STATIC_PAGES: Omit<Action, "run">[] = [
  { label: "Tableau de bord", hint: "g d" },
  { label: "Commandes", hint: "g c" },
  { label: "Mon profil" },
  { label: "Sécurité 2FA" },
];

const PAGE_ROUTES: Record<string, string> = {
  "Tableau de bord": "/admin",
  "Commandes": "/admin/commandes",
  "Mon profil": "/admin/profil",
  "Sécurité 2FA": "/admin/securite",
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminOrderSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ctrl+K ou Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQuery(""); setResults([]); }
  }, [open]);

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      adminApi.listOrders({ q: query, page: 1 } as Parameters<typeof adminApi.listOrders>[0])
        .then((r) => setResults(r.slice(0, 6)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  if (!open) return null;

  const filteredPages = STATIC_PAGES.filter(p =>
    !query || p.label.toLowerCase().includes(query.toLowerCase())
  );

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 px-4 pt-24"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-paper shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-line px-4">
          <span className="text-ink-muted">⌘</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une commande, naviguer…"
            className="h-14 flex-1 bg-transparent px-3 text-base text-ink outline-none placeholder:text-ink-muted"
          />
          <kbd className="rounded border border-line px-2 py-0.5 text-[10px] font-mono text-ink-muted">ESC</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredPages.length > 0 && (
            <div className="mb-2">
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Pages
              </p>
              {filteredPages.map((p) => (
                <button
                  key={p.label}
                  onClick={() => go(PAGE_ROUTES[p.label])}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-paper-dim"
                >
                  <span>{p.label}</span>
                  {p.hint && (
                    <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] font-mono text-ink-muted">{p.hint}</kbd>
                  )}
                </button>
              ))}
            </div>
          )}

          {(searching || results.length > 0) && (
            <div>
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Commandes
              </p>
              {searching && <p className="px-3 py-2 text-xs text-ink-muted">Recherche…</p>}
              {results.map((o) => (
                <button
                  key={o.order_number}
                  onClick={() => go(`/admin/commandes/${o.order_number}`)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-paper-dim"
                >
                  <div>
                    <p className="font-mono text-sm font-bold text-ink">{o.order_number}</p>
                    <p className="text-xs text-ink-muted">{o.customer_email}</p>
                  </div>
                  <span className="text-sm font-bold text-ink">
                    {o.total_ttc.toFixed(2).replace(".", ",")} €
                  </span>
                </button>
              ))}
            </div>
          )}

          {query.length >= 2 && !searching && results.length === 0 && filteredPages.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-ink-muted">Aucun résultat</p>
          )}

          {!query && (
            <p className="px-3 py-2 text-xs text-ink-muted">
              Tapez pour rechercher · <kbd className="rounded border border-line px-1 font-mono">↵</kbd> pour ouvrir
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
