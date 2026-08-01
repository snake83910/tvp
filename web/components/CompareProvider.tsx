"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { TyreResult } from "@/lib/api";

const MAX = 3;
const STORAGE_KEY = "tvp:compare";

interface CompareCtx {
  items: TyreResult[];
  count: number;
  max: number;
  isSelected: (ref: string) => boolean;
  toggle: (tyre: TyreResult) => void;
  remove: (ref: string) => void;
  clear: () => void;
}

const Ctx = createContext<CompareCtx | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<TyreResult[]>([]);

  // Hydratation depuis localStorage (client uniquement)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as TyreResult[]);
    } catch {
      /* stockage indisponible / JSON corrompu : on repart à vide */
    }
  }, []);

  // Mutation via updater fonctionnel : robuste aux clics rapprochés (pas de
  // closure obsolète) ; la persistance se fait à partir de l'état frais.
  const apply = useCallback(
    (fn: (prev: TyreResult[]) => TyreResult[]) => {
      setItems((prev) => {
        const next = fn(prev);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* quota / mode privé : la sélection reste au moins en mémoire */
        }
        return next;
      });
    },
    [],
  );

  const isSelected = useCallback(
    (ref: string) => items.some((t) => t.supplier_ref === ref),
    [items],
  );

  const toggle = useCallback(
    (tyre: TyreResult) =>
      apply((prev) =>
        prev.some((t) => t.supplier_ref === tyre.supplier_ref)
          ? prev.filter((t) => t.supplier_ref !== tyre.supplier_ref)
          : prev.length < MAX
            ? [...prev, tyre]
            : prev,
      ),
    [apply],
  );

  const remove = useCallback(
    (ref: string) => apply((prev) => prev.filter((t) => t.supplier_ref !== ref)),
    [apply],
  );

  const clear = useCallback(() => apply(() => []), [apply]);

  const value = useMemo(
    () => ({ items, count: items.length, max: MAX, isSelected, toggle, remove, clear }),
    [items, isSelected, toggle, remove, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCompare() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCompare hors de CompareProvider");
  return c;
}
