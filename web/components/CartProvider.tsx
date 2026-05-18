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

  useEffect(() => {
    refresh();
  }, [refresh]);

  const count =
    cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;

  return (
    <Ctx.Provider value={{ cart, count, refresh, add }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart hors de CartProvider");
  return c;
}
