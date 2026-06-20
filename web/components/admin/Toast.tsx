"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Tone = "success" | "error" | "info";
interface ToastItem { id: number; tone: Tone; message: string; }

interface Ctx {
  toast: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const ctx = useContext(ToastContext);
  if (!ctx) return { toast: () => {} }; // safe fallback
  return ctx;
}

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, tone: Tone = "info") => {
    const id = ++counter;
    setItems((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <ToastView key={t.id} item={t} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ item }: { item: ToastItem }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(true); }, []);
  const cls =
    item.tone === "success"
      ? "border-ok/40 bg-ok/10 text-ok"
      : item.tone === "error"
      ? "border-signal/40 bg-signal-light text-signal-dark"
      : "border-line bg-paper text-ink";
  return (
    <div
      className={`pointer-events-auto max-w-md rounded-xl border px-4 py-3 text-sm font-semibold shadow-card transition-all ${cls} ${
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      {item.message}
    </div>
  );
}
