"use client";

import { useEffect, useState } from "react";

const BROWSER_API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TOKEN_KEY = "tvp_access";
const REFRESH_KEY = "tvp_refresh";

export function saveTokens(access: string, refresh: string) {
  // localStorage (et pas sessionStorage) : la session survit à un
  // nouvel onglet — sinon "ouvrir dans un nouvel onglet" = déconnecté.
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    // Notifie les composants qui écoutent (ex: useCurrentUser)
    window.dispatchEvent(new Event("tvp:auth-changed"));
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function clearTokens() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    // Nettoyer aussi le panier : éviter qu'un utilisateur suivant
    // qui se connecte sur le même navigateur voie l'ancien panier
    localStorage.removeItem("tvp_cart_session");
    window.dispatchEvent(new Event("tvp:auth-changed"));
  }
}

// ── Refresh automatique ─────────────────────────────────────────────
// L'access token expire au bout de 30 min. Plutôt que de déconnecter
// silencieusement l'utilisateur (potentiellement en plein checkout),
// on échange le refresh token contre une nouvelle paire sur le premier
// 401, puis on rejoue la requête. Single-flight : si N requêtes
// échouent en même temps, un seul appel /auth/refresh part (le backend
// révoque toute la chaîne si un refresh est présenté deux fois).
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh = getRefreshToken();
      if (!refresh) return false;
      try {
        const res = await fetch(`${BROWSER_API}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refresh }),
        });
        if (!res.ok) return false;
        const b = await res.json();
        saveTokens(b.access_token, b.refresh_token);
        return true;
      } catch {
        return false;
      }
    })();
    refreshPromise.finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * fetch avec Authorization + refresh automatique sur 401.
 * À utiliser pour TOUT appel authentifié (lib/cart.ts, lib/admin.ts…)
 * pour que la session soit rafraîchie partout de la même façon.
 */
export async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const doFetch = () => {
    const headers = new Headers(init.headers);
    const t = getToken();
    if (t) headers.set("Authorization", `Bearer ${t}`);
    return fetch(`${BROWSER_API}${path}`, { ...init, headers });
  };
  let res = await doFetch();
  if (res.status === 401 && getRefreshToken()) {
    if (await tryRefresh()) {
      res = await doFetch();
    } else {
      clearTokens();
    }
  }
  return res;
}

async function call<T>(
  path: string,
  method: string,
  body?: unknown,
  auth = false,
): Promise<T> {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  };
  const res = auth
    ? await authFetch(path, init)
    : await fetch(`${BROWSER_API}${path}`, init);
  if (!res.ok) {
    let detail = `Erreur ${res.status}`;
    try {
      const b = await res.json();
      detail = b.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export interface Address {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  postal_code: string;
  city: string;
  country: string;
  is_default: boolean;
}

export interface OrderSummary {
  order_number: string;
  status: string;
  created_at: string;
  total_ttc: number;
  item_count: number;
}

export interface OrderItemDetail {
  supplier_ref: string;
  label: string;
  quantity: number;
  unit_price_ht: number;
  unit_price_ttc: number;
  line_total_ttc: number;
}

export interface OrderDetail {
  order_number: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  delivery_mode: string;
  shipping_address: {
    label?: string | null;
    line1?: string;
    line2?: string | null;
    postal_code?: string;
    city?: string;
    country?: string;
  };
  invoice_number: number | null;
  promo_code?: string | null;
  discount_ttc?: number;
  tracking_number: string | null;
  carrier: string | null;
  tracking_url: string | null;
  items: OrderItemDetail[];
  articles_ht: number;
  articles_ttc: number;
  shipping_ht: number;
  shipping_ttc: number;
  total_ht: number;
  total_vat: number;
  total_ttc: number;
}

export async function downloadInvoice(orderNumber: string): Promise<void> {
  const res = await authFetch(`/me/orders/${orderNumber}/invoice`);
  if (!res.ok) throw new Error("Impossible de télécharger la facture");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `facture-${orderNumber}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export const accountApi = {
  listAddresses: () => call<Address[]>("/me/addresses", "GET", undefined, true),

  addAddress: (a: Omit<Address, "id">) =>
    call<Address>("/me/addresses", "POST", a, true),

  updateAddress: (id: string, a: Omit<Address, "id">) =>
    call<Address>(`/me/addresses/${id}`, "PUT", a, true),

  setDefaultAddress: (id: string) =>
    call<Address>(`/me/addresses/${id}/default`, "PATCH", undefined, true),

  deleteAddress: (id: string) =>
    call<void>(`/me/addresses/${id}`, "DELETE", undefined, true),

  listOrders: () =>
    call<OrderSummary[]>("/me/orders", "GET", undefined, true),

  getOrder: (orderNumber: string) =>
    call<OrderDetail>(`/me/orders/${orderNumber}`, "GET", undefined, true),

  cancelOrder: (orderNumber: string) =>
    call<{ status: string }>(
      `/me/orders/${orderNumber}/cancel`,
      "POST",
      undefined,
      true,
    ),

  changePassword: (old_password: string, new_password: string) =>
    call<void>("/me/password", "POST", { old_password, new_password }, true),

  requestEmailChange: (new_email: string, reauth_token: string) =>
    call<void>(
      "/auth/request-email-change",
      "POST",
      { new_email, reauth_token },
      true,
    ),

  reauth: (password: string) =>
    call<{ reauth_token: string }>("/auth/reauth", "POST", { password }, true),

  exportData: () => call<unknown>("/me/export", "GET", undefined, true),

  deleteAccount: (reauth_token: string) =>
    call<void>("/me/account", "DELETE", { reauth_token }, true),
};

export interface UserMe {
  id: string;
  email: string;
  account_type: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
}

export const auth = {
  register: (data: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    account_type?: "particulier" | "pro";
    pro?: {
      company_name: string;
      siret?: string | null;
      vat_number?: string | null;
    } | null;
  }) =>
    call("/auth/register", "POST", {
      account_type: "particulier",
      ...data,
    }),


  login: async (email: string, password: string) => {
    const r = await call<{
      access_token: string;
      refresh_token: string;
    }>("/auth/login", "POST", { email, password });
    saveTokens(r.access_token, r.refresh_token);
    return r;
  },

  me: () => call<UserMe>("/auth/me", "GET", undefined, true),
};

export function useCurrentUser() {
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (!getToken()) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        // authFetch tente déjà le refresh token sur 401. On ne purge la
        // session QUE sur un 401 confirmé : une erreur réseau ou un 503
        // passager ne doit pas déconnecter l'utilisateur.
        const res = await authFetch("/auth/me");
        if (cancelled) return;
        if (res.ok) {
          setUser((await res.json()) as UserMe);
        } else if (res.status === 401) {
          clearTokens();
          setUser(null);
        }
        // Autre statut (5xx…) : on conserve l'état courant
      } catch {
        // Erreur réseau : on conserve l'état courant
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // "storage" : déclenché quand un AUTRE onglet modifie localStorage
    // (login/logout ailleurs) — garde tous les onglets synchronisés.
    function onStorage(e: StorageEvent) {
      if (e.key === TOKEN_KEY || e.key === null) refresh();
    }

    refresh();
    window.addEventListener("tvp:auth-changed", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("tvp:auth-changed", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { user, loading };
}
