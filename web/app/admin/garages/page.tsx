"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminApi,
  downloadGarageKbis,
  type Garage,
  type GaragePayload,
} from "@/lib/admin";
import { useToast } from "@/components/admin/Toast";
import { errorMessage } from "@/lib/errors";
import { formatEuro } from "@/lib/money";

/**
 * Liste des garages partenaires.
 *
 * L'édition vit désormais sur `/admin/garages/[id]`, où elle réutilise
 * les onglets de l'espace partenaire. Cette page ne garde que ce qui lui
 * revient : la vue d'ensemble et la création.
 *
 * La création se limite volontairement à l'identité du centre. Horaires,
 * congés, grille tarifaire ou créneaux n'ont pas de sens avant que la
 * fiche existe — ils se remplissent ensuite, dans l'éditeur.
 */
type NewGarage = {
  name: string;
  address: string;
  postal_code: string;
  city: string;
  phone: string;
  email: string;
  siret: string;
};

const EMPTY: NewGarage = {
  name: "",
  address: "",
  postal_code: "",
  city: "",
  phone: "",
  email: "",
  siret: "",
};

function toPayload(f: NewGarage): GaragePayload {
  return {
    name: f.name.trim(),
    address: f.address.trim(),
    postal_code: f.postal_code.trim(),
    city: f.city.trim(),
    phone: f.phone.trim() || null,
    email: f.email.trim() || null,
    siret: f.siret.trim() || null,
    // Créé non publié : la fiche est vide, et la publication suppose un
    // contrôle du SIRET et du Kbis.
    is_published: false,
  };
}

export default function AdminGaragesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [garages, setGarages] = useState<Garage[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<NewGarage>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Chaîne de promesses, sans setLoading(true) synchrone : `loading`
  // démarre à true pour le montage, et les rechargements se font en
  // place, liste affichée.
  const load = useCallback(
    () =>
      adminApi
        .listGarages()
        .then(setGarages)
        .catch((e) => toast(errorMessage(e, "Erreur de chargement"), "error"))
        .finally(() => setLoading(false)),
    [toast],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await adminApi.createGarage(toPayload(form));
      toast("Garage créé — complétez sa fiche", "success");
      // Droit dans l'éditeur : une fiche neuve n'a ni horaires ni tarifs,
      // la laisser dans la liste inviterait à l'oublier en l'état.
      router.push(`/admin/garages/${created.id}`);
    } catch (e) {
      toast(errorMessage(e, "Échec de la création"), "error");
      setSaving(false);
    }
  }

  async function remove(g: Garage) {
    if (!confirm(`Supprimer le garage « ${g.name} » ?`)) return;
    try {
      await adminApi.deleteGarage(g.id);
      toast("Garage supprimé", "success");
      await load();
    } catch (e) {
      toast(errorMessage(e, "Échec de la suppression"), "error");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">
            Garages partenaires
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Gérez les garages de montage proposés aux clients au checkout.
          </p>
        </div>
        <button
          onClick={() => {
            setForm(EMPTY);
            setShowForm(true);
          }}
          className="rounded-lg bg-signal px-4 py-2 text-sm font-bold text-white transition hover:bg-signal-dark"
        >
          + Nouveau garage
        </button>
      </div>

      {loading ? (
        <p className="text-ink-muted">Chargement…</p>
      ) : garages.length === 0 ? (
        <div className="rounded-xl border border-line bg-paper p-8 text-center text-ink-muted">
          Aucun garage pour l&apos;instant. Créez le premier partenaire.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-muted">
                <th className="p-3">Nom</th>
                <th className="p-3">Ville</th>
                <th className="p-3">Montage / pneu</th>
                <th className="p-3">Géoloc.</th>
                <th className="p-3">Kbis</th>
                <th className="p-3">RDV</th>
                <th className="p-3">Publié</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {garages.map((g) => (
                <tr key={g.id} className="border-b border-line last:border-0">
                  <td className="p-3 font-semibold text-ink">
                    <Link
                      href={`/admin/garages/${g.id}`}
                      className="hover:text-signal"
                    >
                      {g.name}
                    </Link>
                  </td>
                  <td className="p-3 text-ink-soft">
                    {g.postal_code} {g.city}
                  </td>
                  <td className="p-3 text-ink-soft">
                    {formatEuro(g.mounting_price_cents / 100)}
                  </td>
                  <td className="p-3">
                    {g.lat != null && g.lng != null ? (
                      <span className="text-ok">✓ géocodé</span>
                    ) : (
                      <span className="text-signal">⚠ non géocodé</span>
                    )}
                  </td>
                  <td className="p-3">
                    {g.kbis_path ? (
                      <button
                        onClick={() => downloadGarageKbis(g.id, g.slug)}
                        className="font-semibold text-signal hover:underline"
                      >
                        ↓ voir
                      </button>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {g.appointments_enabled ? (
                      <span className="text-ok">
                        ✓ {g.slot_minutes} min ×{g.slot_capacity}
                      </span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {g.is_published ? (
                      <span className="text-ok">Oui</span>
                    ) : (
                      <span className="text-ink-muted">Non</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/admin/garages/${g.id}`}
                      className="mr-3 font-semibold text-signal hover:underline"
                    >
                      Éditer
                    </Link>
                    <button
                      onClick={() => remove(g)}
                      className="font-semibold text-ink-muted hover:text-signal"
                    >
                      Suppr.
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setShowForm(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={create}
            className="my-8 w-full max-w-lg rounded-2xl bg-paper p-6 shadow-lift"
          >
            <h2 className="font-display text-lg font-black text-ink">
              Nouveau garage
            </h2>
            <p className="mb-4 mt-1 text-xs text-ink-muted">
              Seule l&apos;identité du centre est demandée ici. Horaires,
              tarifs et rendez-vous se règlent ensuite dans sa fiche.
            </p>
            <div className="space-y-3">
              <Field label="Nom" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Adresse" required value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Code postal" required value={form.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} />
                <Field label="Ville" required value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Téléphone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              </div>
              <Field label="SIRET" value={form.siret} onChange={(v) => setForm({ ...form, siret: v })} />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:border-signal"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-signal px-5 py-2 text-sm font-bold text-white transition hover:bg-signal-dark disabled:opacity-60"
              >
                {saving ? "Création…" : "Créer et compléter"}
              </button>
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              L&apos;adresse est géocodée et le SIRET vérifié auprès de Sirene
              à l&apos;enregistrement. La fiche est créée non publiée.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal"
      />
    </div>
  );
}
