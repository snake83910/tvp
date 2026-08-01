import { SeasonLanding } from "@/components/SeasonLanding";

export const metadata = {
  title: "Pneus 4 saisons : la polyvalence toute l'année — tousvospneus.com",
  description:
    "Les pneus 4 saisons : une seule monte toute l'année, souvent homologués 3PMSF. Idéal en climat doux. Comparez les prix.",
  alternates: { canonical: "/pneus-4-saisons" },
};

export default function Pneus4SaisonsPage() {
  return <SeasonLanding season="4saisons" />;
}
