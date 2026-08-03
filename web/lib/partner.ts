"use client";

import { authFetch, saveTokens } from "@/lib/auth";
import type { Garage, GaragePayload } from "@/lib/admin";

export interface PartnerRegisterData {
  email: string;
  password: string;
  garage_name: string;
  address: string;
  postal_code: string;
  city: string;
  siret: string;
  phone?: string | null;
  kbis?: File | null;
}

/** Inscription d'un garage partenaire : crée le compte + la fiche garage
 * (non publiée, avec SIRET et Kbis) et connecte directement. Envoi en
 * multipart pour joindre le document Kbis. */
export async function partnerRegister(data: PartnerRegisterData): Promise<void> {
  const fd = new FormData();
  fd.append("email", data.email);
  fd.append("password", data.password);
  fd.append("garage_name", data.garage_name);
  fd.append("address", data.address);
  fd.append("postal_code", data.postal_code);
  fd.append("city", data.city);
  fd.append("siret", data.siret);
  if (data.phone) fd.append("phone", data.phone);
  if (data.kbis) fd.append("kbis", data.kbis);

  // Pas de Content-Type manuel : le navigateur pose le boundary multipart.
  const res = await authFetch("/partner/register", { method: "POST", body: fd });
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
  const r = (await res.json()) as { access_token: string; refresh_token: string };
  saveTokens(r.access_token, r.refresh_token);
}

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await authFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
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

export interface PartnerOrderItem {
  label: string;
  quantity: number;
  dimension: string | null;
}

export interface PartnerOrder {
  order_number: string;
  status: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  items: PartnerOrderItem[];
  mounting_at: string | null;
  mounting_note: string | null;
}

export type {
  Garage,
  GaragePayload,
  GarageClosure,
  GaragePricingRow,
} from "@/lib/admin";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** URL publique d'une photo de garage à partir de son chemin relatif. */
export function mediaUrl(path: string): string {
  return `${API_BASE}/garages/media/${path}`;
}

async function upload(path: string, file: File): Promise<Garage> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await authFetch(path, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return res.json() as Promise<Garage>;
}

export const partnerApi = {
  getGarage: () => call<Garage>("/partner/garage"),
  updateGarage: (data: Partial<GaragePayload>) =>
    call<Garage>("/partner/garage", "PATCH", data),
  listOrders: () => call<PartnerOrder[]>("/partner/orders"),
  setAppointment: (orderNumber: string, mounting_at: string | null, note: string | null) =>
    call<PartnerOrder>(`/partner/orders/${orderNumber}/appointment`, "PATCH", {
      mounting_at,
      note,
    }),
  addPhoto: (file: File) => upload("/partner/garage/photos", file),
  removePhoto: (path: string) =>
    call<Garage>(`/partner/garage/photos?path=${encodeURIComponent(path)}`, "DELETE"),
};
