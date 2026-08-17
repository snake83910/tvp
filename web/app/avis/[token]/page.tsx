import { AvisClient } from "./AvisClient";

export const metadata = {
  title: "Donner mon avis — tousvospneus.com",
  robots: { index: false },
};

export default async function AvisPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  return <AvisClient token={token} />;
}
