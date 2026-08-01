import { SeasonLanding } from "@/components/SeasonLanding";

export const metadata = {
  title: "Pneus été : performance et sécurité au meilleur prix — tousvospneus.com",
  description:
    "Les pneus été offrent la meilleure adhérence au-dessus de 7 °C, sur sol sec et mouillé. Comparez et achetez au meilleur prix.",
  alternates: { canonical: "/pneus-ete" },
};

export default function PneusEtePage() {
  return <SeasonLanding season="ete" />;
}
