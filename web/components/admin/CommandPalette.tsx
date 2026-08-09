"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, type AdminOrderSummary } from "@/lib/admin";
import { formatEuro } from "@/lib/money";

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

  // La remise à zéro (saisie + résultats) vit dans close(), appelée depuis
  // les ÉVÉNEMENTS de fermeture (Échap, Ctrl+K, clic sur le voile, choix
  // d'un résultat) — et non plus dans un effet réagissant à `open`, qui
  // posait un setState synchrone au moment où la palette se fermait.
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ctrl+K ou Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else setOpen(true);
      }
      if (e.key === "Escape" && open) close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    // En deçà de 2 caractères on ne lance rien : l'affichage est DÉRIVÉ
    // (shownResults) au lieu d'être vidé par un setState synchrone ici.
    if (query.length < 2) return;
    const t = setTimeout(() => {
      setSearching(true);
      adminApi.listOrders({ q: query, page: 1 } as Parameters<typeof adminApi.listOrders>[0])
        .then((r) => setResults(r.slice(0, 6)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Les résultats d'une requête devenue trop courte ne s'affichent jamais,
  // même si l'état `results` les porte encore.
  const shownResults = query.length >= 2 ? results : [];

  if (!open) return null;

  const filteredPages = STATIC_PAGES.filter(p =>
    !query || p.label.toLowerCase().includes(query.toLowerCase())
  );

  function go(href: string) {
    close();
    router.push(href);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 px-4 pt-24"
      onClick={close}
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

          {query.length >= 2 && (searching || shownResults.length > 0) && (
            <div>
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Commandes
              </p>
              {searching && <p className="px-3 py-2 text-xs text-ink-muted">Recherche…</p>}
              {shownResults.map((o) => (
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
                    {formatEuro(o.total_ttc)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {query.length >= 2 && !searching && shownResults.length === 0 && filteredPages.length === 0 && (
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
