import { TokenActionPage } from "@/components/TokenActionPage";

export const metadata = {
  title: "Confirmation de votre nouvelle adresse — tousvospneus.com",
  robots: { index: false },
};

export default function ConfirmerEmailPage() {
  return (
    <TokenActionPage
      endpoint="/auth/confirm-email-change"
      pendingLabel="Confirmation de votre nouvelle adresse…"
      successTitle="Email confirmé ✓"
      successText="Votre nouvelle adresse email est active."
      errorTitle="Confirmation impossible"
    />
  );
}
