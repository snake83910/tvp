import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { PopularDimensions } from "@/components/PopularDimensions";

export type SeasonKey = "ete" | "hiver" | "4saisons";

type SeasonContent = {
  h1: string;
  intro: string;
  points: { title: string; body: string }[];
  note?: string;
};

const CONTENT: Record<SeasonKey, SeasonContent> = {
  hiver: {
    h1: "Pneus hiver",
    intro:
      "Conçus pour les températures basses, les pneus hiver conservent une gomme souple sous 7 °C et offrent une adhérence nettement supérieure sur neige, verglas et route froide. Ils sont indispensables dès que l'hiver s'installe.",
    points: [
      {
        title: "Quand les monter ?",
        body:
          "Dès que la température passe durablement sous 7 °C, généralement de novembre à mars. En dessous de ce seuil, un pneu été perd de son efficacité même sur route sèche.",
      },
      {
        title: "Le marquage 3PMSF",
        body:
          "Cherchez le pictogramme montagne à trois pics + flocon (3PMSF) : c'est la seule garantie d'homologation hiver. Le marquage M+S seul ne suffit plus au regard de la Loi Montagne.",
      },
      {
        title: "Loi Montagne",
        body:
          "Dans les zones concernées, les pneus 3PMSF (ou les chaînes/chaussettes) sont obligatoires du 1er novembre au 31 mars.",
      },
    ],
    note: "Astuce : montez toujours vos pneus hiver par 4 pour un comportement équilibré du véhicule.",
  },
  ete: {
    h1: "Pneus été",
    intro:
      "Les pneus été offrent la meilleure adhérence et les distances de freinage les plus courtes au-dessus de 7 °C, sur sol sec comme mouillé. C'est le choix de référence pour la majeure partie de l'année en France.",
    points: [
      {
        title: "Pour qui ?",
        body:
          "Idéal dans les régions à hiver doux et pour la conduite de mars à octobre. Le meilleur compromis performance / longévité / consommation.",
      },
      {
        title: "Sécurité sous la pluie",
        body:
          "Regardez la note d'adhérence sur sol mouillé de l'étiquette européenne (A à E) : c'est le critère de sécurité le plus important pour un pneu été.",
      },
      {
        title: "Économies de carburant",
        body:
          "La classe d'efficacité énergétique (A à E) reflète la résistance au roulement : un pneu bien noté réduit votre consommation.",
      },
    ],
  },
  "4saisons": {
    h1: "Pneus 4 saisons",
    intro:
      "Les pneus 4 saisons (toutes saisons) sont un compromis polyvalent : une seule monte toute l'année, sans changement saisonnier. Ils conviennent aux climats doux et aux faibles kilométrages.",
    points: [
      {
        title: "Pour qui ?",
        body:
          "Parfaits en ville et dans les régions aux hivers peu rigoureux, pour les conducteurs qui roulent peu et veulent éviter le double jeu de pneus.",
      },
      {
        title: "Homologués hiver",
        body:
          "La plupart des 4 saisons portent le marquage 3PMSF : ils sont donc conformes à la Loi Montagne, contrairement aux pneus été.",
      },
      {
        title: "Le bon compromis",
        body:
          "Un peu en retrait d'un pneu spécialisé été en performance pure et d'un pneu hiver sur neige profonde, mais très pratiques au quotidien.",
      },
    ],
  },
};

export function SeasonLanding({ season }: { season: SeasonKey }) {
  const c = CONTENT[season];
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
          {c.h1}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{c.intro}</p>

        <div className="mt-8 space-y-6">
          {c.points.map((p) => (
            <section key={p.title}>
              <h2 className="font-display text-lg font-bold text-ink">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{p.body}</p>
            </section>
          ))}
        </div>

        {c.note && (
          <p className="mt-6 rounded-lg bg-paper-dim p-4 text-xs text-ink-muted">
            {c.note}
          </p>
        )}

        <p className="mt-6 text-sm text-ink-soft">
          Pour tout comprendre sur le choix de vos pneus, consultez notre{" "}
          <Link href="/guide" className="font-semibold text-signal hover:underline">
            guide du pneu
          </Link>
          .
        </p>

        <PopularDimensions />

        <div className="mt-10 rounded-2xl border border-line bg-paper-dim p-6 text-center">
          <p className="font-display text-lg font-bold text-ink">
            Trouvez vos pneus {c.h1.toLowerCase().replace("pneus ", "")}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Recherchez par dimensions puis filtrez par saison.
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
