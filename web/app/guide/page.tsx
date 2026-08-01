import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Guide du pneu : dimensions, indices de charge et de vitesse — tousvospneus.com",
  description:
    "Comment lire la dimension d'un pneu, comprendre les indices de charge et de vitesse, choisir sa saison, décoder l'étiquette européenne et la date DOT.",
  alternates: { canonical: "/guide" },
};

// Indices de charge usuels (tourisme) → charge maximale par pneu en kg.
const LOAD_INDEX: [number, number][] = [
  [75, 387], [79, 437], [82, 475], [84, 500], [85, 515], [87, 545],
  [88, 560], [89, 580], [91, 615], [92, 630], [94, 670], [95, 690],
  [97, 730], [98, 750], [100, 800], [102, 850], [104, 900], [106, 950],
  [108, 1000], [110, 1060], [112, 1120],
];

// Indices de vitesse → vitesse maximale autorisée en km/h.
const SPEED_INDEX: [string, string][] = [
  ["N", "140"], ["P", "150"], ["Q", "160"], ["R", "170"], ["S", "180"],
  ["T", "190"], ["U", "200"], ["H", "210"], ["V", "240"], ["W", "270"],
  ["Y", "300"], ["ZR", "> 240"],
];

export default function GuidePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
          Guide du pneu
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Tout ce qu&apos;il faut savoir pour choisir des pneus adaptés à
          votre véhicule : lire la dimension, comprendre les indices de
          charge et de vitesse, choisir la saison et décoder l&apos;étiquette
          européenne.
        </p>

        {/* Lecture de la dimension */}
        <Section title="Lire la dimension inscrite sur le flanc">
          <p>
            La dimension est gravée sur le flanc (côté) de vos pneus
            actuels, par exemple <strong>205/55 R16 91V</strong>. C&apos;est
            l&apos;information la plus importante pour trouver un pneu
            compatible.
          </p>
          <p className="my-5 select-none font-mono text-2xl font-black tracking-wider md:text-3xl">
            <span className="border-b-4 border-signal text-ink">205</span>
            <span className="text-ink-muted">/</span>
            <span className="border-b-4 border-amber-500 text-ink">55</span>
            <span className="text-ink-muted"> R</span>
            <span className="border-b-4 border-blue-500 text-ink">16</span>{" "}
            <span className="border-b-4 border-ok text-ink">91</span>
            <span className="border-b-4 border-purple-500 text-ink">V</span>
          </p>
          <ul className="space-y-2">
            <Legend color="bg-signal" term="205">largeur du pneu en millimètres</Legend>
            <Legend color="bg-amber-500" term="55">hauteur du flanc, en % de la largeur (série)</Legend>
            <Legend color="bg-blue-500" term="16">diamètre de la jante en pouces</Legend>
            <Legend color="bg-ok" term="91">indice de charge (voir tableau)</Legend>
            <Legend color="bg-purple-500" term="V">indice de vitesse (voir tableau)</Legend>
          </ul>
          <p className="mt-4 rounded-lg bg-paper-dim p-4 text-xs text-ink-muted">
            Les lettres <strong>R</strong> (radial) et parfois <strong>ZR</strong> désignent
            la structure du pneu. Un <strong>C</strong> après le diamètre (ex. R16C)
            indique un pneu utilitaire renforcé.
          </p>
        </Section>

        {/* Indice de charge */}
        <Section title="Indice de charge">
          <p>
            L&apos;indice de charge indique le poids maximal que peut
            supporter chaque pneu, gonflé à la pression recommandée.{" "}
            <strong>
              Il doit être au moins égal à celui préconisé sur votre carte
              grise
            </strong>{" "}
            (repère 8.2). Un indice supérieur est autorisé, jamais inférieur.
          </p>
          <RefTable
            head={["Indice", "Charge max / pneu"]}
            rows={LOAD_INDEX.map(([i, kg]) => [String(i), `${kg} kg`])}
          />
        </Section>

        {/* Indice de vitesse */}
        <Section title="Indice de vitesse">
          <p>
            L&apos;indice de vitesse (une lettre) correspond à la vitesse
            maximale supportée par le pneu. Il doit être{" "}
            <strong>au moins égal</strong> à celui de la monte d&apos;origine
            de votre véhicule. Seule exception : les pneus hiver peuvent avoir
            un indice de vitesse inférieur, à condition de respecter la vitesse
            maximale correspondante.
          </p>
          <RefTable
            head={["Indice", "Vitesse max"]}
            rows={SPEED_INDEX.map(([l, kmh]) => [l, `${kmh} km/h`])}
          />
        </Section>

        {/* Saisons */}
        <Section title="Été, hiver ou 4 saisons ?">
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong>Été</strong> — la meilleure adhérence et le meilleur
              freinage au-dessus de 7 °C, sur sol sec comme mouillé.
            </li>
            <li>
              <strong>Hiver</strong> — gomme et sculpture optimisées sous 7 °C,
              sur neige et verglas. Repérables au marquage{" "}
              <strong>M+S</strong> et surtout au pictogramme{" "}
              <strong>3PMSF</strong> (montagne à trois pics + flocon).
            </li>
            <li>
              <strong>4 saisons</strong> — un compromis polyvalent pour les
              régions à climat doux et les faibles kilométrages.
            </li>
          </ul>
          <p className="mt-4 rounded-lg bg-paper-dim p-4 text-xs text-ink-muted">
            <strong>Loi Montagne</strong> : dans les zones concernées, du 1er
            novembre au 31 mars, seuls les pneus marqués <strong>3PMSF</strong>{" "}
            (ou les chaînes/chaussettes) sont acceptés. Le marquage M+S seul ne
            suffit plus.
          </p>
        </Section>

        {/* Étiquette européenne */}
        <Section title="L'étiquette européenne">
          <p>Depuis 2021, chaque pneu porte une étiquette normalisée notant :</p>
          <ul className="ml-5 mt-2 list-disc space-y-2">
            <li>
              <strong>Efficacité énergétique</strong> (A à E) — résistance au
              roulement, donc consommation de carburant.
            </li>
            <li>
              <strong>Adhérence sur sol mouillé</strong> (A à E) — distance de
              freinage sous la pluie, un critère de sécurité majeur.
            </li>
            <li>
              <strong>Bruit de roulement</strong> — en décibels, avec une
              classe A/B/C.
            </li>
          </ul>
          <p className="mt-3">
            Ces notes sont affichées sur chaque fiche produit du site.
          </p>
        </Section>

        {/* DOT */}
        <Section title="Âge du pneu : le code DOT">
          <p>
            Le code <strong>DOT</strong> gravé sur le flanc se termine par
            quatre chiffres indiquant la semaine et l&apos;année de
            fabrication : <strong>3903</strong> signifie la 39ᵉ semaine de
            2003. Un pneu se conserve plusieurs années avant montage, mais il
            est recommandé de vérifier ce marquage et de ne pas rouler avec des
            pneus de plus de 10 ans.
          </p>
        </Section>

        {/* CTA */}
        <div className="mt-10 rounded-2xl border border-line bg-paper-dim p-6 text-center">
          <p className="font-display text-lg font-bold text-ink">
            Prêt à trouver vos pneus ?
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Lancez une recherche par dimensions ou par plaque
            d&apos;immatriculation.
          </p>
          <Link
            href="/recherche"
            className="mt-4 inline-block rounded-full bg-signal px-8 py-3 font-display text-sm font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark"
          >
            Rechercher mes pneus
          </Link>
        </div>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
        {children}
      </div>
    </section>
  );
}

function Legend({
  color,
  term,
  children,
}: {
  color: string;
  term: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-baseline gap-2">
      <span className={`mt-1 inline-block h-3 w-3 shrink-0 rounded-sm ${color}`} />
      <span>
        <strong className="text-ink">{term}</strong>
        <span className="text-ink-muted"> — {children}</span>
      </span>
    </li>
  );
}

function RefTable({ head, rows }: { head: [string, string]; rows: string[][] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[280px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line-strong text-left">
            <th className="py-2 pr-4 font-bold text-ink">{head[0]}</th>
            <th className="py-2 font-bold text-ink">{head[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-b border-line">
              <td className="py-1.5 pr-4 font-mono font-semibold text-ink">{r[0]}</td>
              <td className="py-1.5 text-ink-soft">{r[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
