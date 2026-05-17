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
  return res.json() as Promise<T>;
}

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
    if (!getToken()) {
      setLoading(false);
      return;
    }
    auth
      .me()
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}
