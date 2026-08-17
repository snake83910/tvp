import { SuiviClient } from "./SuiviClient";

export const metadata = {
  title: "Suivre ma commande — tousvospneus.com",
  description:
    "Suivez votre commande de pneus avec votre numéro de commande et " +
    "votre adresse email, sans créer de compte.",
};

export default function SuiviPage() {
  return <SuiviClient />;
}
