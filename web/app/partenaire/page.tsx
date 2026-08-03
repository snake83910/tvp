"use client";

import { useEffect, useState } from "react";
import { partnerApi, type Garage, type GaragePayload, type PartnerOrder } from "@/lib/partner";
import { DashboardTab } from "@/components/partner/tabs/DashboardTab";
import { CoordonneesTab } from "@/components/partner/tabs/CoordonneesTab";
import { HorairesTab } from "@/components/partner/tabs/HorairesTab";
import { CongesTab } from "@/components/partner/tabs/CongesTab";
import { TarifsTab } from "@/components/partner/tabs/TarifsTab";
import { PaiementTab } from "@/components/partner/tabs/PaiementTab";
import { CommandesTab } from "@/components/partner/tabs/CommandesTab";

const TABS = [
  { key: "dashboard", label: "Tableau de bord" },
  { key: "coordonnees", label: "Coordonnées" },
  { key: "horaires", label: "Horaires" },
  { key: "conges", label: "Congés" },
  { key: "tarifs", label: "Prestations & tarifs" },
  { key: "paiement", label: "Moyens de paiement" },
  { key: "commandes", label: "Commandes" },
  { key: "media", label: "Media" },
  { key: "avis", label: "Avis" },
  { key: "rdv", label: "Rendez-vous montage" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function PartnerDashboard() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [garage, setGarage] = useState<Garage | null>(null);
  const [orders, setOrders] = useState<PartnerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [noGarage, setNoGarage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setGarage(await partnerApi.getGarage());
        setOrders(await partnerApi.listOrders());
      } catch {
        setNoGarage(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(patch: Partial<GaragePayload>) {
    setSaving(true);
    setFlash(null);
    try {
      const g = await partnerApi.updateGarage(patch);
      setGarage(g);
      setFlash("Modifications enregistrées.");
      setTimeout(() => setFlash(null), 3000);
    } catch (e) {
      setFlash(e instanceof Error ? e.message : "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-ink-muted">Chargement…</p>
      </main>
    );
  }

  if (noGarage || !garage) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="font-display text-2xl font-black text-ink">Espace partenaire</h1>
        <p className="mt-3 rounded-xl border border-line bg-paper p-6 text-ink-muted">
          Aucun garage n&apos;est encore rattaché à votre compte. Contactez
          l&apos;équipe tousvospneus.com pour finaliser votre inscription.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">{garage.name}</h1>
          <p className="text-sm text-ink-muted">
            {garage.is_published ? "Page publiée" : "En attente de validation"}
          </p>
        </div>
        {flash && (
          <span className="rounded-lg bg-ok/10 px-3 py-1.5 text-sm font-semibold text-ok">
            {flash}
          </span>
        )}
      </div>

      {/* Onglets */}
      <div className="mt-6 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition ${
              tab === t.key
                ? "border-signal text-signal"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.key === "commandes" && orders.length > 0 ? ` (${orders.length})` : ""}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "dashboard" && <DashboardTab garage={garage} orders={orders} />}
        {tab === "coordonnees" && <CoordonneesTab garage={garage} save={save} saving={saving} />}
        {tab === "horaires" && <HorairesTab garage={garage} save={save} saving={saving} />}
        {tab === "conges" && <CongesTab garage={garage} save={save} saving={saving} />}
        {tab === "tarifs" && <TarifsTab garage={garage} save={save} saving={saving} />}
        {tab === "paiement" && <PaiementTab garage={garage} save={save} saving={saving} />}
        {tab === "commandes" && <CommandesTab orders={orders} />}
        {(tab === "media" || tab === "avis" || tab === "rdv") && (
          <div className="rounded-xl border border-line bg-paper p-8 text-center text-ink-muted">
            Bientôt disponible.
          </div>
        )}
      </div>
    </main>
  );
}
