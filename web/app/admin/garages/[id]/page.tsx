"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, use } from "react";
import {
  adminApi,
  downloadGarageKbis,
  type Garage,
  type GaragePayload,
} from "@/lib/admin";
import { useToast } from "@/components/admin/Toast";
import { errorMessage } from "@/lib/errors";
import { CoordonneesTab } from "@/components/garage/CoordonneesTab";
import { HorairesTab } from "@/components/garage/HorairesTab";
import { CongesTab } from "@/components/garage/CongesTab";
import { TarifsTab } from "@/components/garage/TarifsTab";
import { PaiementTab } from "@/components/garage/PaiementTab";
import { RdvSettings } from "@/components/garage/RdvSettings";

const TABS = [
  { key: "coordonnees", label: "Coordonnées" },
  { key: "horaires", label: "Horaires" },
  { key: "conges", label: "Congés" },
  { key: "tarifs", label: "Prestations & tarifs" },
  { key: "paiement", label: "Moyens de paiement" },
  { key: "rdv", label: "Rendez-vous" },
  { key: "acces", label: "Publication & accès" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Édition d'un garage — le MÊME éditeur que l'espace partenaire.
 *
 * L'admin avait son propre formulaire, qui ne savait éditer ni les
 * horaires, ni les congés, ni la grille tarifaire, ni les moyens de
 * paiement. Or l'espace partenaire renvoie explicitement vers l'équipe
 * pour toute correction : on promettait un service qu'aucun écran ne
 * permettait de rendre. Pire, les champs communs étaient définis deux
 * fois, et cette divergence avait déjà fait écraser les horaires
 * structurées du partenaire par le champ texte libre de l'admin.
 *
 * Les onglets sont donc les composants du partenaire, avec la portée
 * admin en plus : coordonnées éditables et délai de rendez-vous réglable.
 *
 * Une page plutôt qu'une modale : sept onglets ne tiennent pas dans une
 * boîte de dialogue, et une URL par garage se partage et se met en
 * favori.
 */
export default function AdminGarageEditPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(props.params);
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>("coordonnees");
  const [garage, setGarage] = useState<Garage | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");

  const load = useCallback(
    () =>
      adminApi
        .getGarage(id)
        .then(setGarage)
        .catch(() => setNotFound(true)),
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  /** Enregistrement partiel. L'admin peut tout envoyer — c'est lui qui
   *  détient les champs verrouillés côté partenaire. */
  const save = useCallback(
    async (patch: Partial<GaragePayload>) => {
      setSaving(true);
      try {
        setGarage(await adminApi.updateGarage(id, patch));
        toast("Fiche mise à jour", "success");
      } catch (e) {
        toast(errorMessage(e, "Échec de l'enregistrement"), "error");
      } finally {
        setSaving(false);
      }
    },
    [id, toast],
  );

  async function attachOwner() {
    const email = ownerEmail.trim();
    if (!email) return;
    setSaving(true);
    try {
      setGarage(await adminApi.setGarageOwner(id, email));
      setOwnerEmail("");
      toast("Compte gérant rattaché", "success");
    } catch (e) {
      toast(errorMessage(e, "Rattachement impossible"), "error");
    } finally {
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <div className="rounded-xl border border-line bg-paper p-8 text-center">
        <p className="text-ink-muted">Garage introuvable.</p>
        <Link
          href="/admin/garages"
          className="mt-4 inline-block font-semibold text-signal hover:underline"
        >
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  if (!garage) return <p className="text-ink-muted">Chargement…</p>;

  return (
    <div>
      <Link
        href="/admin/garages"
        className="text-sm text-ink-muted hover:text-signal"
      >
        ← Garages partenaires
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">
            {garage.name}
          </h1>
          <p className="text-sm text-ink-muted">
            {garage.postal_code} {garage.city} ·{" "}
            {garage.is_published ? (
              <span className="font-semibold text-ok">publié</span>
            ) : (
              <span className="font-semibold text-signal">non publié</span>
            )}
          </p>
        </div>
        <Link
          href={`/garages/${garage.slug}`}
          target="_blank"
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal"
        >
          Voir la page publique ↗
        </Link>
      </div>

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
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "coordonnees" && (
          <CoordonneesTab
            garage={garage}
            save={save}
            saving={saving}
            saveIdentity={save}
          />
        )}
        {tab === "horaires" && (
          <HorairesTab garage={garage} save={save} saving={saving} />
        )}
        {tab === "conges" && (
          <CongesTab garage={garage} save={save} saving={saving} />
        )}
        {tab === "tarifs" && (
          <TarifsTab garage={garage} save={save} saving={saving} />
        )}
        {tab === "paiement" && (
          <PaiementTab garage={garage} save={save} saving={saving} />
        )}
        {tab === "rdv" && (
          <RdvSettings
            garage={garage}
            save={save}
            saving={saving}
            canEditLeadDays
          />
        )}
        {tab === "acces" && (
          <div className="max-w-xl space-y-6">
            <div className="rounded-xl border border-line bg-paper p-5">
              <h2 className="font-display text-base font-bold text-ink">
                Publication
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Un garage non publié n&apos;apparaît ni au checkout, ni dans la
                recherche de montage. C&apos;est l&apos;état d&apos;un
                partenaire inscrit dont le SIRET et le Kbis n&apos;ont pas
                encore été contrôlés.
              </p>
              <button
                onClick={() => save({ is_published: !garage.is_published })}
                disabled={saving}
                className={`mt-3 rounded-lg px-5 py-2 text-sm font-bold transition disabled:opacity-60 ${
                  garage.is_published
                    ? "border border-line text-ink-soft hover:border-signal hover:text-signal"
                    : "bg-signal text-white hover:bg-signal-dark"
                }`}
              >
                {garage.is_published ? "Dépublier" : "Publier la fiche"}
              </button>
            </div>

            <div className="rounded-xl border border-line bg-paper p-5">
              <h2 className="font-display text-base font-bold text-ink">
                Justificatifs
              </h2>
              <p className="mt-1 text-sm">
                SIRET :{" "}
                {garage.siret_verified ? (
                  <span className="font-semibold text-ok">
                    ✓ vérifié auprès de Sirene (établissement actif)
                  </span>
                ) : (
                  <span className="font-semibold text-amber-700">
                    ⚠ non vérifié — à contrôler manuellement
                  </span>
                )}
              </p>
              {garage.siret_company_name && (
                <p className="mt-0.5 text-sm text-ink-muted">
                  Raison sociale Sirene :{" "}
                  <span className="font-semibold text-ink">
                    {garage.siret_company_name}
                  </span>
                </p>
              )}
              <div className="mt-3">
                {garage.kbis_path ? (
                  <button
                    onClick={() => downloadGarageKbis(garage.id, garage.slug)}
                    className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-signal transition hover:border-signal"
                  >
                    ↓ Télécharger le Kbis
                  </button>
                ) : (
                  <p className="text-sm text-ink-muted">
                    Aucun Kbis déposé par ce partenaire.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-paper p-5">
              <h2 className="font-display text-base font-bold text-ink">
                Compte gérant
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {garage.owner_user_id
                  ? "Un compte gérant est rattaché. Saisir un autre email le remplace."
                  : "Rattache (ou crée) le compte qui gérera cette fiche et verra les commandes. Un email d'accès part si le compte est créé."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="gerant@garage.fr"
                  className="h-10 min-w-[220px] flex-1 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-signal"
                />
                <button
                  onClick={attachOwner}
                  disabled={saving || !ownerEmail.trim()}
                  className="rounded-lg bg-ink px-5 text-sm font-bold text-paper transition hover:bg-signal disabled:opacity-50"
                >
                  Rattacher
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
