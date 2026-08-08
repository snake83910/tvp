import type { Address } from "@/lib/auth";
import { Input } from "./fields";
import type { AddressDraft } from "./types";

/** Choix d'une adresse du carnet, ou saisie d'une nouvelle. Partagé par
 *  la livraison et la facturation — d'où le radioName distinct. */
export function AddressPicker({
  radioName,
  addresses,
  selectedId,
  onSelect,
  showNew,
  onShowNew,
  draft,
  onDraft,
}: {
  radioName: string;
  addresses: Address[];
  selectedId: string;
  onSelect: (id: string) => void;
  showNew: boolean;
  onShowNew: (v: boolean) => void;
  draft: AddressDraft;
  onDraft: (d: AddressDraft) => void;
}) {
  return (
    <>
      {addresses.length > 0 && !showNew && (
        <div className="space-y-2">
          {addresses.map((a) => (
            <label
              key={a.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${
                selectedId === a.id
                  ? "border-signal bg-signal-light"
                  : "border-line hover:border-signal/50"
              }`}
            >
              <input
                type="radio"
                name={radioName}
                checked={selectedId === a.id}
                onChange={() => onSelect(a.id)}
                className="mt-1 accent-signal"
              />
              <div>
                <p className="font-semibold text-ink">
                  {a.label ?? "Adresse"}
                </p>
                <p className="text-sm text-ink-muted">
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}, {a.postal_code}{" "}
                  {a.city}
                </p>
              </div>
            </label>
          ))}
          <button
            onClick={() => onShowNew(true)}
            className="text-sm font-semibold text-signal hover:underline"
          >
            + Ajouter une nouvelle adresse
          </button>
        </div>
      )}
      {showNew && (
        <div className="space-y-3">
          <Input
            label="Adresse"
            value={draft.line1}
            onChange={(v) => onDraft({ ...draft, line1: v })}
          />
          <Input
            label="Complément (facultatif)"
            value={draft.line2}
            onChange={(v) => onDraft({ ...draft, line2: v })}
            required={false}
          />
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Code postal"
              value={draft.postal_code}
              onChange={(v) => onDraft({ ...draft, postal_code: v })}
            />
            <div className="col-span-2">
              <Input
                label="Ville"
                value={draft.city}
                onChange={(v) => onDraft({ ...draft, city: v })}
              />
            </div>
          </div>
          {addresses.length > 0 && (
            <button
              onClick={() => onShowNew(false)}
              className="text-sm text-ink-muted hover:text-signal"
            >
              ← Utiliser une adresse existante
            </button>
          )}
        </div>
      )}
    </>
  );
}
