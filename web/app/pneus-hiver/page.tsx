import { SeasonLanding } from "@/components/SeasonLanding";

export const metadata = {
  title: "Pneus hiver : 3PMSF, Loi Montagne et meilleurs prix — tousvospneus.com",
  description:
    "Tout sur les pneus hiver : quand les monter, le marquage 3PMSF, la Loi Montagne. Trouvez vos pneus hiver au meilleur prix.",
  alternates: { canonical: "/pneus-hiver" },
};

export default function PneusHiverPage() {
  return <SeasonLanding season="hiver" />;
}
