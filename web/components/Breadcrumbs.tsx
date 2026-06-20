import Link from "next/link";

interface Crumb {
  label: string;
  href?: string;
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tousvospneus.com";

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  // JSON-LD pour SEO (Google rich snippets)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.label,
      ...(it.href ? { item: `${SITE}${it.href}` } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Fil d'Ariane" className="mb-4 text-sm">
        <ol className="flex flex-wrap items-center gap-1.5 text-ink-muted">
          {items.map((it, i) => {
            const last = i === items.length - 1;
            return (
              <li key={i} className="flex items-center gap-1.5">
                {it.href && !last ? (
                  <Link href={it.href} className="hover:text-signal">{it.label}</Link>
                ) : (
                  <span className={last ? "font-semibold text-ink" : ""} aria-current={last ? "page" : undefined}>
                    {it.label}
                  </span>
                )}
                {!last && <span aria-hidden="true">›</span>}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
