"use client";

import { useEffect, useState } from "react";

const BROWSER_API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TOKEN_KEY = "tvp_access";
const REFRESH_KEY = "tvp_refresh";

export function saveTokens(access: string, refresh: string) {
  // Stockage en mémoire de session navigateur (pas localStorage en SSR)
  if (typeof window !== "undefined") {
    sessionStorage.setItem(TOKEN_KEY, access);
    sessionStorage.setItem(REFRESH_KEY, refresh);
    // Notifie les composants qui écoutent (ex: useCurrentUser)
    window.dispatchEvent(new Event("tvp:auth-changed"));
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function clearTokens() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    // Nettoyer aussi le panier : éviter qu'un utilisateur suivant
    // qui se connecte sur le même navigateur voie l'ancien panier
    localStorage.removeItem("tvp_cart_session");
  }
}

async function call<T>(
  path: string,
  method: string,
  body?: unknown,
  auth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${BROWSER_API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
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
  const token = getToken();
  const res = await fetch(
    `${BROWSER_API}/me/orders/${orderNumber}/invoice`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
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

  changePassword: (old_password: string, new_password: string) =>
    call<void>("/me/password", "POST", { old_password, new_password }, true),

  requestEmailChange: (new_email: string) =>
    call<void>("/auth/request-email-change", "POST", { new_email }, true),

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
  }) =>
    call("/auth/register", "POST", {
      ...data,
      account_type: "particulier",
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

    function refresh() {
      if (!getToken()) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      auth
        .me()
        .then((u) => { if (!cancelled) setUser(u); })
        .catch(() => clearTokens())
        .finally(() => { if (!cancelled) setLoading(false); });
    }

    refresh();
    window.addEventListener("tvp:auth-changed", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("tvp:auth-changed", refresh);
    };
  }, []);

  return { user, loading };
}
