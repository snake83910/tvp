"use client";

import { useEffect } from "react";

export function Drawer({
  open,
  onClose,
  title,
  children,
  width = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex-1 bg-ink/40" onClick={onClose} />
      <div className={`flex w-full ${width} flex-col bg-paper shadow-card animate-in slide-in-from-right`}>
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <p className="font-display text-base font-black text-ink">{title}</p>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink-soft hover:bg-paper-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
