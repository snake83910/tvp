"use client";

/**
 * Lecture de localStorage compatible SSR, sans setState dans un effet.
 *
 * L'ancien motif (« hydrater un useState depuis localStorage dans un
 * useEffect ») déclenchait un second rendu en cascade juste après le
 * montage — c'est ce que react-hooks/set-state-in-effect signale. Le
 * remplacement canonique est useSyncExternalStore : le serveur rend la
 * valeur par défaut, React bascule sur la valeur du client au bon moment
 * du cycle d'hydratation, et aucun effet n'est nécessaire.
 *
 * Les écritures passent par writeLocal() pour notifier les composants
 * abonnés : localStorage n'émet d'événement `storage` qu'entre onglets,
 * jamais dans celui qui écrit.
 */
import { useCallback, useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((cb) => cb());
}

/** Écrit (ou efface, avec null) une clé et re-rend les abonnés. */
export function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* quota plein / mode privé : la valeur vit au moins en mémoire React */
  }
  notify(key);
}

/** Valeur brute d'une clé localStorage.
 *
 *  `serverValue` est ce que rendent le serveur ET la passe d'hydratation ;
 *  React re-rend ensuite avec la vraie valeur du client (mécanisme géré
 *  par useSyncExternalStore, pas par un effet à nous). Le défaut `null`
 *  (= « clé absente ») convient quand l'absence rend un état vide ; pour
 *  un composant dont l'absence AFFICHE quelque chose (ex. tour
 *  d'onboarding), passer une valeur serveur qui le masque, sinon il
 *  flasherait à chaque chargement chez ceux qui l'ont déjà fermé. */
export function useLocalValue(
  key: string,
  serverValue: string | null = null,
): string | null {
  const subscribe = useCallback(
    (cb: () => void) => {
      let set = listeners.get(key);
      if (!set) {
        set = new Set();
        listeners.set(key, set);
      }
      set.add(cb);
      return () => {
        set.delete(cb);
      };
    },
    [key],
  );
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => serverValue,
  );
}
