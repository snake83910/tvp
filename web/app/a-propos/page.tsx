import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "À propos de nous — tousvospneus.com",
  description:
    "TOUSVOSPNEUS.COM : un large choix de pneumatiques et de pièces détachées à prix compétitifs, livrés en France.",
};

const paragraphs = [
  "TOUSVOSPNEUS.COM a été créé en 2023 par des spécialistes de l'automobile et du e-commerce. La plateforme offre un large choix de pneumatiques et de pièces détachées à destination des particuliers.",
  "Depuis sa création, TOUSVOSPNEUS.COM connaît une forte croissance et un grand succès commercial, notamment en raison de ses prix compétitifs, de sa qualité de service, de son écoute et de sa réactivité.",
  "La plateforme est gratuite pour tous les particuliers. Inscrivez-vous et vous aurez accès à l'un des plus grands catalogues nationaux, à des prix défiant toute concurrence. Nos outils sont d'une grande efficacité et vous permettent de trouver vos pneus rapidement.",
  "Grâce à notre équipe commerciale à l'écoute de nos clients et à notre équipe technique, notre site est mis à jour quotidiennement pour répondre au mieux à vos besoins. TOUSVOSPNEUS.COM vous propose un accès à un stock important grâce à ses nombreux fournisseurs, assurant ainsi une continuité d'approvisionnement.",
  "L'équipe TOUSVOSPNEUS.COM récolte chaque jour les prix et la disponibilité chez l'ensemble de nos fournisseurs. Ces prix viennent enrichir le système, permettant aux particuliers de mieux connaître le marché et de réaliser des économies, notamment grâce à notre comparateur de prix, lui aussi mis à jour régulièrement.",
];

export default function AProposPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-black tracking-tightest text-ink">
          À propos de nous
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Le site est actuellement disponible en France.
        </p>

        <article className="mt-8 space-y-5 text-sm leading-relaxed text-ink-soft">
          {paragraphs.map((text) => (
            <p key={text.slice(0, 24)}>{text}</p>
          ))}
          <p className="font-display text-lg font-bold text-ink">
            Bienvenue chez TOUSVOSPNEUS.COM.
          </p>
        </article>
      </main>
    </>
  );
}
