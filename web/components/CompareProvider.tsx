"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import type { TyreResult } from "@/lib/api";
import { useLocalValue, writeLocal } from "@/lib/localStore";

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

function parse(raw: string | null): TyreResult[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as TyreResult[];
  } catch {
    /* JSON corrompu : on repart à vide */
    return [];
  }
}

export function CompareProvider({ children }: { children: React.ReactNode }) {
  // localStorage EST la source de vérité, lue via useSyncExternalStore
  // (lib/localStore). L'ancien montage — un useState hydraté par un
  // useEffect — dupliquait l'état et déclenchait un rendu en cascade au
  // montage ; ici le serveur rend une sélection vide, React bascule sur
  // la valeur du client à l'hydratation, et chaque écriture re-rend les
  // abonnés via writeLocal.
  const raw = useLocalValue(STORAGE_KEY);
  const items = useMemo(() => parse(raw), [raw]);

  // Les mutations relisent le stockage au moment du clic (et non `items`
  // capturé par la closure) : deux clics rapprochés partent chacun de
  // l'état réellement persisté — même garantie que l'ancien updater
  // fonctionnel de setItems.
  const apply = useCallback(
    (fn: (prev: TyreResult[]) => TyreResult[]) => {
      let current: string | null = null;
      try {
        current = localStorage.getItem(STORAGE_KEY);
      } catch {
        /* stockage indisponible : on part de vide */
      }
      const next = fn(parse(current));
      writeLocal(STORAGE_KEY, JSON.stringify(next));
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
