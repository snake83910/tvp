import { TokenActionPage } from "@/components/TokenActionPage";

export const metadata = {
  title: "Vérification de votre email — tousvospneus.com",
  robots: { index: false },
};

export default function VerifyEmailPage() {
  return (
    <TokenActionPage
      endpoint="/auth/verify-email"
      pendingLabel="Vérification de votre email…"
      successTitle="Email vérifié ✓"
      successText="Votre adresse a bien été confirmée."
      errorTitle="Vérification impossible"
    />
  );
}
