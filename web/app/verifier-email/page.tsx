import { VerifyEmailClient } from "./VerifyEmailClient";

export const metadata = {
  title: "Vérification de votre email — tousvospneus.com",
  robots: { index: false },
};

export default function VerifyEmailPage() {
  return <VerifyEmailClient />;
}
