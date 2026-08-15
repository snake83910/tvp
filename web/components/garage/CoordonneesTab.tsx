"use client";

import { useState } from "react";
import type { Garage, GaragePayload, PartnerEditablePayload } from "@/lib/partner";
import { Field, SaveButton, TabHeader } from "@/components/garage/ui";
import { SUPPORT_EMAIL, SUPPORT_PHONE } from "@/components/garage/constants";

/** Coordonnées du centre — partagé par l'espace partenaire et l'admin.
 *
 *  Ces informations identifient l'établissement (raison sociale, adresse
 *  géocodée, SIRET vérifié) et sont figées dans chaque commande passée
 *  chez lui. Les laisser modifiables côté partenaire, c'est risquer de
 *  voir une commande partir à une adresse qui ne correspond plus à celle
 *  affichée au client. Leur correction passe donc par l'équipe — le
 *  backend refuse d'ailleurs ces champs sur /partner/garage (403).
 *
 *  D'où les deux modes du MÊME composant : le partenaire lit sa fiche et
 *  ne modifie que sa présentation ; l'admin édite tout. Un seul endroit
 *  définit ces champs, leur ordre et leurs libellés — c'est précisément
 *  la divergence entre les deux écrans qui avait laissé le formulaire
 *  admin écraser les horaires du partenaire. */
export function CoordonneesTab({
  garage,
  save,
  saving,
  // Mode admin : les coordonnées deviennent éditables et partent par
  // `saveIdentity`, distinct de `save` pour que le type du partenaire
  // continue d'interdire ces champs à la compilation.
  saveIdentity,
}: {
  garage: Garage;
  save: (p: PartnerEditablePayload) => Promise<void>;
  saving: boolean;
  saveIdentity?: (p: Partial<GaragePayload>) => Promise<void>;
}) {
  const editable = saveIdentity !== undefined;
  const [description, setDescription] = useState(garage.description ?? "");
  const [identity, setIdentity] = useState({
    name: garage.name,
    address: garage.address,
    postal_code: garage.postal_code,
    city: garage.city,
    phone: garage.phone ?? "",
    email: garage.email ?? "",
    siret: garage.siret ?? "",
  });

  function setField<K extends keyof typeof identity>(k: K, v: string) {
    setIdentity((p) => ({ ...p, [k]: v }));
  }

  const mailto =
    `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent(`Modification des coordonnées — ${garage.name}`)}` +
    `&body=${encodeURIComponent(
      `Bonjour,\n\nJe souhaite modifier les coordonnées du centre « ${garage.name} » ` +
        `(${garage.address}, ${garage.postal_code} ${garage.city}).\n\n` +
        `Information à corriger :\n\nNouvelle valeur :\n\nMerci.`,
    )}`;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <TabHeader
          title="Coordonnées du centre"
          subtitle="Ces informations apparaissent sur votre page publique et au checkout."
        />

        {editable ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveIdentity!({
                name: identity.name.trim(),
                address: identity.address.trim(),
                postal_code: identity.postal_code.trim(),
                city: identity.city.trim(),
                phone: identity.phone.trim() || null,
                email: identity.email.trim() || null,
                siret: identity.siret.trim() || null,
              });
            }}
            className="space-y-3"
          >
            <Field label="Nom du centre" value={identity.name} onChange={(v) => setField("name", v)} required />
            <Field label="Adresse" value={identity.address} onChange={(v) => setField("address", v)} required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code postal" value={identity.postal_code} onChange={(v) => setField("postal_code", v)} required />
              <Field label="Ville" value={identity.city} onChange={(v) => setField("city", v)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Téléphone" value={identity.phone} onChange={(v) => setField("phone", v)} />
              <Field label="Email" type="email" value={identity.email} onChange={(v) => setField("email", v)} />
            </div>
            <Field label="SIRET" value={identity.siret} onChange={(v) => setField("siret", v)} />
            <p className="text-xs text-ink-muted">
              {garage.siret_verified ? (
                <span className="font-semibold text-ok">✓ SIRET vérifié auprès de Sirene</span>
              ) : (
                <span className="font-semibold text-amber-700">⚠ SIRET non vérifié auprès de Sirene</span>
              )}
              {garage.siret_company_name && ` — raison sociale : ${garage.siret_company_name}`}
              . L&apos;adresse est re-géocodée et le SIRET re-vérifié à
              l&apos;enregistrement.
            </p>
            <SaveButton saving={saving}>Enregistrer les coordonnées</SaveButton>
          </form>
        ) : (
        <dl className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper">
          <Row label="Nom du centre" value={garage.name} />
          <Row
            label="Adresse"
            value={`${garage.address}, ${garage.postal_code} ${garage.city}`}
          />
          <Row label="Téléphone" value={garage.phone} />
          <Row label="Email" value={garage.email} />
          <Row
            label="SIRET"
            value={garage.siret}
            badge={
              garage.siret_verified
                ? { text: "Vérifié Sirene", tone: "ok" }
                : { text: "Non vérifié", tone: "warn" }
            }
          />
          {garage.siret_company_name && (
            <Row label="Raison sociale" value={garage.siret_company_name} />
          )}
        </dl>
        )}

        {!editable && (
        <div className="mt-4 rounded-xl border border-line bg-paper-dim p-4">
          <p className="text-sm font-semibold text-ink">
            Une information est incorrecte ?
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Les coordonnées de votre centre sont verrouillées : elles sont
            figées dans chaque commande et servent au calcul du garage le
            plus proche. Notre équipe les met à jour sur simple demande.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={mailto}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-paper transition hover:bg-signal"
            >
              Demander une modification
            </a>
            {SUPPORT_PHONE && (
              <a
                href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}
                className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal"
              >
                {SUPPORT_PHONE}
              </a>
            )}
          </div>
        </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save({ description: description.trim() || null });
        }}
      >
        <TabHeader
          title="Présentation"
          subtitle="Le texte affiché sur votre page publique. Libre à vous de le modifier."
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          placeholder="Présentez votre centre : équipe, équipements, spécialités…"
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal"
        />
        <div className="mt-3">
          <SaveButton saving={saving} />
        </div>
      </form>
    </div>
  );
}

function Row({
  label,
  value,
  badge,
}: {
  label: string;
  value: string | null | undefined;
  badge?: { text: string; tone: "ok" | "warn" };
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
      <dt className="w-40 shrink-0 text-xs font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </dt>
      <dd className="flex flex-wrap items-center gap-2 text-sm text-ink">
        <span>{value?.trim() || <span className="text-ink-muted">—</span>}</span>
        {badge && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              badge.tone === "ok"
                ? "bg-ok/10 text-ok"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {badge.text}
          </span>
        )}
      </dd>
    </div>
  );
}
