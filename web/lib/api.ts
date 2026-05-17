/**
 * Client API vers le backend FastAPI.
 *
 * Côté serveur (SSR) : utilise l'URL interne Docker (http://api:8000).
 * Côté navigateur : utilise l'URL publique (NEXT_PUBLIC_API_URL).
 */

const SERVER_API = process.env.API_URL_INTERNAL || "http://api:8000";
const BROWSER_API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function baseUrl(): string {
  return typeof window === "undefined" ? SERVER_API : BROWSER_API;
}

export interface TyreResult {
  supplier_ref: string;
  brand: string;
  model: string;
  dimension: string;
  width: number | null;
  aspect_ratio: number | null;
  diameter: number | null;
  load_index: number | null;
  speed_rating: string | null;
  season: string;
  image_url: string | null;
  eu_label: Record<string, unknown>;
  price_ht: number;
  price_ttc: number;
  display_price: number;
  display_mode: "HT" | "TTC";
}

export interface ApiError {
  detail: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `Erreur ${res.status}`;
    try {
      const body = (await res.json()) as ApiError;
      detail = body.detail || detail;
    } catch {
      /* corps non JSON */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string; env: string }>("/health"),

  searchByDimensions: (
    width: number,
    ratio: number,
    diameter: number,
    season?: string,
    token?: string,
  ) => {
    const q = new URLSearchParams({
      width: String(width),
      ratio: String(ratio),
      diameter: String(diameter),
    });
    if (season) q.set("season", season);
    return request<TyreResult[]>(`/search/dimensions?${q.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
};
