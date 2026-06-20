"use client";

import { useState } from "react";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={label ?? "Copier"}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-muted transition hover:bg-paper-dim hover:text-signal"
      aria-label={label ?? "Copier"}
    >
      {copied ? (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-ok">
          <path d="M16.7 5.7a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L9 12l6.3-6.3a1 1 0 011.4 0z" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-3.5 w-3.5">
          <rect x="6" y="6" width="10" height="10" rx="1.5" />
          <path d="M4 14V5a1 1 0 011-1h9" />
        </svg>
      )}
    </button>
  );
}
