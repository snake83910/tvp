"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  cartApi,
  clearCartSession,
  getCartSession,
  type Cart,
} from "@/lib/cart";
import { getToken } from "@/lib/auth";
import { formatEuro } from "@/lib/money";

interface CartCtx {
  cart: Cart | null;
  count: number;
  refresh: () => Promise<void>;
  add: (item: {
    supplier_ref: string;
    width: number;
    ratio: number;
    diameter: number;
    quantity: number;
  }) => Promise<void>;
  updateQty: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
}

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cart, setCart] = useState<Cart | null>(null);

  const refresh = useCallback(async () => {
    try {
      const c = await cartApi.get();
      setCart(c);
    } catch {
      setCart(null); // panier vide => 404, normal
    }
  }, []);

  const add = useCallback(
    async (item: {
      supplier_ref: string;
      width: number;
      ratio: number;
      diameter: number;
      quantity: number;
    }) => {
      let c = await cartApi.addItem(item);
      if (!c.items?.length) {
        // Réponse incohérente (proxy/cache intermédiaire) : le panier
        // re-fetché fait foi — jamais de toast « 0 pneu, 0 € »
        c = (await cartApi.get()) ?? c;
      }
      setCart(c);
      // Mini-panier : confirme l'ajout avec le total et un CTA panier
      const line = c.items.find(
        (i) => i.supplier_ref === item.supplier_ref,
      );
      setJustAdded({
        label: line?.label ?? "Article ajouté",
        qty: item.quantity,
        totalTtc: c.total_ttc,
        count: c.items.reduce((s, i) => s + i.quantity, 0),
      });
    },
    [],
  );

  const [justAdded, setJustAdded] = useState<{
    label: string;
    qty: number;
    totalTtc: number;
    count: number;
  } | null>(null);

  // Auto-fermeture du mini-panier après 6 s
  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => setJustAdded(null), 6000);
    return () => clearTimeout(t);
  }, [justAdded]);

  // Met à jour la quantité d'une ligne ET le state local avec la
  // réponse renvoyée par l'API (pas de re-fetch nécessaire). Tous les
  // composants qui lisent useCart() se redessinent automatiquement :
  // page panier, compteur du header, etc.
  const updateQty = useCallback(
    async (itemId: string, quantity: number) => {
      const c = await cartApi.updateQty(itemId, quantity);
      setCart(c);
    },
    [],
  );

  // Suppression d'une ligne. Si c'était la dernière, l'API peut
  // renvoyer un panier vide ou un 404 selon le code -> on retombe sur
  // un refresh propre dans ce cas.
  const removeItem = useCallback(
    async (itemId: string) => {
      try {
        const c = await cartApi.removeItem(itemId);
        // Si l'API a renvoyé un panier vide (0 items), on le garde
        // tel quel pour que l'UI affiche "panier vide" immédiatement.
        setCart(c);
      } catch {
        // Cas où la suppression a vidé le panier et le backend renvoie
        // 404 -> on aligne le state à "vide".
        setCart(null);
      }
    },
    [],
  );

  useEffect(() => {
    refresh();
  }, []);

  // À la connexion : fusionne le panier anonyme dans le panier du compte.
  // Sans cet appel, l'article mis au panier avant de se connecter était
  // PERDU (l'endpoint /cart/merge existait côté API mais n'était jamais
  // appelé par le front) — le client arrivait au checkout panier vide.
  useEffect(() => {
    async function onAuthChanged() {
      if (getToken() && getCartSession()) {
        try {
          await cartApi.merge();
          clearCartSession(); // le panier anonyme n'existe plus côté API
        } catch {
          // Pas de panier anonyme à fusionner : rien à faire
        }
      }
      refresh();
    }
    window.addEventListener("tvp:auth-changed", onAuthChanged);
    return () =>
      window.removeEventListener("tvp:auth-changed", onAuthChanged);
  }, [refresh]);

  const count =
    cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;

  return (
    <Ctx.Provider
      value={{ cart, count, refresh, add, updateQty, removeItem }}
    >
      {children}

      {/* Mini-panier : glisse en bas à droite après chaque ajout */}
      {justAdded && (
        <div
          className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-line bg-paper p-5 shadow-lift"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-bold text-ok">✓ Ajouté au panier</p>
            <button
              onClick={() => setJustAdded(null)}
              className="text-ink-muted hover:text-signal"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 truncate text-sm text-ink" title={justAdded.label}>
            {justAdded.qty} × {justAdded.label}
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Total panier ({justAdded.count} pneu{justAdded.count > 1 ? "s" : ""})
            {" : "}
            <span className="font-display font-black text-ink">
              {formatEuro(justAdded.totalTtc)}
            </span>
          </p>
          <div className="mt-3 flex gap-2">
            <a
              href="/panier"
              className="flex-1 rounded-full bg-signal py-2 text-center text-sm font-bold text-white transition hover:bg-signal-dark"
            >
              Voir le panier
            </a>
            <button
              onClick={() => setJustAdded(null)}
              className="flex-1 rounded-full border border-line py-2 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal"
            >
              Continuer
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart hors de CartProvider");
  return c;
}
