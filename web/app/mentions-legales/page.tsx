import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Mentions légales — tousvospneus.com",
  description: "Éditeur, directeur de publication et hébergeur du site tousvospneus.com.",
};

export default function MentionsLegalesPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-black tracking-tightest text-ink">
          Mentions légales
        </h1>

        <article className="mt-8 space-y-8 text-sm leading-relaxed text-ink-soft">
          <section>
            <h2 className="font-display text-lg font-bold text-ink">Éditeur</h2>
            <p className="mt-2">
              Ce site est édité par <strong>TOUSVOSPNEUS.COM</strong>, société par
              actions simplifiée au capital de 500,00 €, dont le siège social est
              situé au 35B Chemin des Beaumouilles, 13710 Fuveau.
            </p>
            <ul className="mt-3 ml-6 list-disc space-y-1">
              <li>
                Immatriculée au R.C.S. d&apos;Aix-en-Provence sous le numéro
                977 671 965.
              </li>
              <li>Numéro de TVA intracommunautaire : FR38 977 671 965.</li>
              <li>
                Email :{" "}
                <a
                  href="mailto:contact@tousvospneus.com"
                  className="text-signal hover:underline"
                >
                  contact@tousvospneus.com
                </a>
                .
              </li>
              <li>Directeur de la publication : Rémy SIMON.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">Hébergeur</h2>
            <p className="mt-2">
              Le site est hébergé par <strong>IONOS SARL</strong>, 7 place de la
              Gare, BP 70109, 57201 Sarreguemines Cedex, France. Société
              immatriculée au R.C.S. de Sarreguemines sous le numéro B 431 303 775.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">Responsabilité</h2>
            <p className="mt-2">
              L&apos;ensemble des informations accessibles via ce site sont
              fournies en l&apos;état. TOUSVOSPNEUS.COM ne donne aucune garantie,
              explicite ou implicite, et n&apos;assume aucune responsabilité
              relative à l&apos;utilisation de ces informations. TOUSVOSPNEUS.COM
              n&apos;est responsable ni de l&apos;exactitude, ni des erreurs, ni des
              omissions contenues sur ce site. L&apos;utilisateur est seul
              responsable de l&apos;utilisation de telles informations.
            </p>
            <p className="mt-2">
              TOUSVOSPNEUS.COM se réserve le droit de modifier à tout moment les
              présentes mentions, notamment en actualisant ce site.
              TOUSVOSPNEUS.COM ne pourra être responsable de quelque dommage que ce
              soit, tant direct qu&apos;indirect, résultant d&apos;une information
              contenue sur ce site.
            </p>
            <p className="mt-2">
              Les sites extérieurs ayant un lien hypertexte avec le présent site ne
              sont pas sous son contrôle ; TOUSVOSPNEUS.COM décline par conséquent
              toute responsabilité quant à leur contenu. L&apos;utilisateur est seul
              responsable de leur utilisation.
            </p>
          </section>
        </article>
      </main>
    </>
  );
}
