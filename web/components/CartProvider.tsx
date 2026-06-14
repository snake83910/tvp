"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { cartApi, type Cart } from "@/lib/cart";

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
      const c = await cartApi.addItem(item);
      setCart(c);
    },
    [],
  );

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

  const count =
    cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;

  return (
    <Ctx.Provider
      value={{ cart, count, refresh, add, updateQty, removeItem }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart hors de CartProvider");
  return c;
}
