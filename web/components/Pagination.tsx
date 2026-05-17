"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function Pagination({
  page,
  pages,
}: {
  page: number;
  pages: number;
}) {
  const router = useRouter();
  const params = useSearchParams();

  if (pages <= 1) return null;

  function go(p: number) {
    const q = new URLSearchParams(params.toString());
    q.set("page", String(p));
    router.push(`/recherche?${q.toString()}`);
  }

  // Fenêtre de pages autour de la courante
  const around = 2;
  const start = Math.max(1, page - around);
  const end = Math.min(pages, page + around);
  const nums: number[] = [];
  for (let i = start; i <= end; i++) nums.push(i);

  return (
    <nav className="mt-12 flex items-center justify-center gap-2">
      <PageBtn
        disabled={page <= 1}
        onClick={() => go(page - 1)}
        label="‹"
      />
      {start > 1 && (
        <>
          <PageBtn onClick={() => go(1)} label="1" />
          {start > 2 && (
            <span className="px-1 text-ink-muted">…</span>
          )}
        </>
      )}
      {nums.map((n) => (
        <PageBtn
          key={n}
          active={n === page}
          onClick={() => go(n)}
          label={String(n)}
        />
      ))}
      {end < pages && (
        <>
          {end < pages - 1 && (
            <span className="px-1 text-ink-muted">…</span>
          )}
          <PageBtn onClick={() => go(pages)} label={String(pages)} />
        </>
      )}
      <PageBtn
        disabled={page >= pages}
        onClick={() => go(page + 1)}
        label="›"
      />
    </nav>
  );
}

function PageBtn({
  label,
  onClick,
  active,
  disabled,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-10 min-w-10 rounded-lg border px-3 text-sm font-semibold transition ${
        active
          ? "border-signal bg-signal text-white"
          : "border-ink-muted text-ink-muted hover:border-bone/40 disabled:opacity-30"
      }`}
    >
      {label}
    </button>
  );
}
