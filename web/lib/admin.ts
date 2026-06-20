"use client";

import { getToken } from "@/lib/auth";
import type { OrderDetail } from "@/lib/auth";

const BROWSER_API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BROWSER_API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = `Erreur ${res.status}`;
    try {
      const b = await res.json();
      detail = b.detail || detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export interface AdminStats {
  orders_by_status: Record<string, number>;
  revenue_total_ttc: number;
  orders_today: number;
  revenue_today_ttc: number;
  orders_30d?: number;
  revenue_30d_ttc?: number;
  avg_cart_ttc?: number;
  top_products?: { ref: string; label: string; qty: number; revenue_ttc: number }[];
}

export interface AuditEntry {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

export interface AdminOrderSummary {
  order_number: string;
  status: string;
  created_at: string;
  total_ttc: number;
  item_count: number;
  customer_email: string;
  customer_name: string | null;
}

export interface AdminOrderDetail extends OrderDetail {
  customer_email: string;
  customer_name: string | null;
  allowed_transitions: string[];
}

export async function downloadAdminInvoice(orderNumber: string): Promise<void> {
  const token = getToken();
  const res = await fetch(
    `${BROWSER_API}/admin/orders/${orderNumber}/invoice`,
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

export const adminApi = {
  getStats: () => call<AdminStats>("/admin/stats"),

  listOrders: (params?: {
    status?: string; q?: string; page?: number;
    from_date?: string; to_date?: string;
    min_amount?: number; max_amount?: number;
  }) => {
    const p = new URLSearchParams();
    if (params?.status) p.set("status", params.status);
    if (params?.q) p.set("q", params.q);
    if (params?.page) p.set("page", String(params.page));
    if (params?.from_date) p.set("from_date", params.from_date);
    if (params?.to_date) p.set("to_date", params.to_date);
    if (params?.min_amount != null) p.set("min_amount", String(params.min_amount));
    if (params?.max_amount != null) p.set("max_amount", String(params.max_amount));
    const qs = p.toString();
    return call<AdminOrderSummary[]>(`/admin/orders${qs ? `?${qs}` : ""}`);
  },

  getOrder: (orderNumber: string) =>
    call<AdminOrderDetail>(`/admin/orders/${orderNumber}`),

  updateStatus: (
    orderNumber: string,
    data: {
      status: string;
      tracking_number?: string;
      carrier?: string;
      tracking_url?: string;
      cancel_reason?: string;
    }
  ) => call<AdminOrderDetail>(`/admin/orders/${orderNumber}/status`, "PATCH", data),

  updateNote: (orderNumber: string, admin_note: string) =>
    call<AdminOrderDetail>(`/admin/orders/${orderNumber}/note`, "PATCH", { admin_note }),

  listAudit: (orderNumber: string) =>
    call<AuditEntry[]>(`/admin/orders/${orderNumber}/audit`),

  getSparkline: () => call<{ days: string[]; revenue: number[]; orders: number[] }>(`/admin/stats/sparkline`),

  getAttention: () =>
    call<{
      to_ship: AdminOrderSummary[];
      late: AdminOrderSummary[];
    }>(`/admin/orders-attention`),
};
