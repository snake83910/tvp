import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { GUIDE_ARTICLES, getGuideArticle } from "@/lib/guides";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tousvospneus.com";

// Contenu 100 % statique : pages générées au build (SSG).
export function generateStaticParams() {
  return GUIDE_ARTICLES.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const article = getGuideArticle(params.slug);
  if (!article) return { title: "Guide du pneu | tousvospneus.com" };
  return {
    title: `${article.metaTitle} — tousvospneus.com`,
    description: article.description,
    alternates: { canonical: `/guide/${article.slug}` },
    openGraph: {
      title: article.metaTitle,
      description: article.description,
      url: `${SITE}/guide/${article.slug}`,
      type: "article",
      siteName: "tousvospneus.com",
    },
  };
}

export default function GuideArticlePage({
  params,
}: {
  params: { slug: string };
}) {
  const article = getGuideArticle(params.slug);
  if (!article) notFound();

  const others = GUIDE_ARTICLES.filter((a) => a.slug !== article.slug);

  // Le BreadcrumbList est déjà émis par le composant <Breadcrumbs>.
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Article",
      headline: article.title,
      description: article.description,
      inLanguage: "fr-FR",
      mainEntityOfPage: `${SITE}/guide/${article.slug}`,
      author: { "@type": "Organization", name: "tousvospneus.com" },
      publisher: { "@id": `${SITE}/#organization` },
    },
  ];
  if (article.faq && article.faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: article.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }
  const jsonLd = { "@context": "https://schema.org", "@graph": graph };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Breadcrumbs
          items={[
            { label: "Accueil", href: "/" },
            { label: "Guide du pneu", href: "/guide" },
            { label: article.title },
          ]}
        />

        <article>
          <h1 className="mt-2 font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
            {article.title}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft md:text-base">
            {article.intro}
          </p>

          {article.sections.map((s) => (
            <section key={s.h2} className="mt-10">
              <h2 className="font-display text-xl font-bold text-ink">{s.h2}</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
                {s.paragraphs.map((p) => (
                  <p key={p.slice(0, 32)}>{p}</p>
                ))}
                {s.list && (
                  <ul className="ml-5 list-disc space-y-2">
                    {s.list.map((li) => (
                      <li key={li.slice(0, 32)}>{li}</li>
                    ))}
                  </ul>
                )}
                {s.note && (
                  <p className="rounded-lg bg-paper-dim p-4 text-xs text-ink-muted">
                    {s.note}
                  </p>
                )}
              </div>
            </section>
          ))}

          {article.faq && article.faq.length > 0 && (
            <section className="mt-10">
              <h2 className="font-display text-xl font-bold text-ink">
                Questions fréquentes
              </h2>
              <div className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
                {article.faq.map((f) => (
                  <details key={f.q} className="group px-5 py-4">
                    <summary className="cursor-pointer font-display text-sm font-bold text-ink marker:content-none">
                      {f.q}
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                      {f.a}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </article>

        {/* CTA */}
        <div className="mt-10 rounded-2xl border border-line bg-paper-dim p-6 text-center">
          <p className="font-display text-lg font-bold text-ink">
            Besoin de pneus ?
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Recherchez par dimensions, livraison à domicile ou montage en
            garage partenaire.
          </p>
          <Link
            href="/recherche"
            className="mt-4 inline-block rounded-full bg-signal px-8 py-3 font-display text-sm font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark"
          >
            Rechercher mes pneus
          </Link>
        </div>

        {/* Maillage interne : les autres articles du hub */}
        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-ink">
            À lire aussi
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/guide" className="font-semibold text-signal-dark hover:underline">
                Guide du pneu : dimensions, indices de charge et de vitesse
              </Link>
            </li>
            {others.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/guide/${a.slug}`}
                  className="font-semibold text-signal-dark hover:underline"
                >
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
