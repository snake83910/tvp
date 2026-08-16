"use client";

import { useEffect, useState } from "react";
import {
  adminApi,
  type PlateProviderSetting,
  type PlateTestResult,
} from "@/lib/admin";
import { useToast } from "@/components/admin/Toast";

/** Ce que chaque mode implique, en clair. Un choix de fournisseur n'a
 *  rien d'évident : l'un a un quota, l'autre un problème de légitimité,
 *  et l'écran doit dire lequel on accepte. */
const MODE_INFO: Record<
  string,
  { label: string; hint: string; tone: "good" | "warn" }
> = {
  siv: {
    label: "SIV, Midas en secours",
    hint:
      "Fournisseur officiel en premier. Si son quota est atteint ou s'il " +
      "ne répond pas, la recherche bascule sur Midas pour ne pas laisser " +
      "le client sans réponse.",
    tone: "good",
  },
  siv_only: {
    label: "SIV uniquement",
    hint:
      "Aucun appel à Midas. Le plus propre juridiquement, mais une " +
      "plaque non trouvée ou un quota atteint renvoie le client vers la " +
      "saisie manuelle de ses dimensions.",
    tone: "good",
  },
  midas: {
    label: "Midas uniquement",
    hint:
      "Comportement historique : appel de l'API interne de Midas en " +
      "imitant un navigateur pour passer leur protection anti-bot. Sans " +
      "convention, l'accès peut cesser du jour au lendemain.",
    tone: "warn",
  },
};

export default function AdminReglages() {
  const { toast } = useToast();
  const [plate, setPlate] = useState<PlateProviderSetting | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testPlate, setTestPlate] = useState("");
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<PlateTestResult[] | null>(null);

  useEffect(() => {
    adminApi
      .getPlateProvider()
      .then(setPlate)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"));
  }, []);

  async function choose(mode: string) {
    if (!plate || mode === plate.mode) return;
    setSaving(mode);
    try {
      setPlate(await adminApi.setPlateProvider(mode));
      toast("Fournisseur basculé", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setSaving(null);
    }
  }

  async function runTest() {
    setTesting(true);
    setResults(null);
    try {
      const r = await adminApi.testPlateProvider(testPlate.trim());
      setResults(r.results);
      // Le test consomme du quota : le compteur affiché doit suivre.
      setPlate(await adminApi.getPlateProvider());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setTesting(false);
    }
  }

  if (error) {
    return (
      <p className="rounded-xl bg-signal-light px-4 py-3 text-sm text-signal-dark">
        {error}
      </p>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-black text-ink">Réglages</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Paramètres modifiables en exploitation, sans redéploiement.
      </p>

      <section className="mt-8 rounded-2xl border border-line bg-paper p-6 shadow-card">
        <h2 className="font-display text-lg font-black text-ink">
          Recherche par plaque d&apos;immatriculation
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Fournisseur interrogé pour retrouver les dimensions d&apos;un
          véhicule. Le résultat est mis en cache 24 h par plaque.
        </p>

        {!plate ? (
          <p className="mt-4 text-sm text-ink-muted">Chargement…</p>
        ) : (
          <>
            {/* La clé manquante rend le mode SIV inopérant : le dire
                avant que quelqu'un ne bascule et ne constate une panne. */}
            {!plate.siv_configured && (
              <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                <strong>SIV_API_KEY absente du serveur.</strong> Les modes
                utilisant SIV sont sans effet tant que la clé n&apos;est pas
                renseignée dans <code>.env</code> — inscription gratuite sur
                apiplaqueimmatriculation.com.
              </p>
            )}

            <div className="mt-5 space-y-3">
              {plate.modes.map((mode) => {
                const info = MODE_INFO[mode];
                const actif = plate.mode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => choose(mode)}
                    disabled={saving !== null}
                    className={`w-full rounded-xl border p-4 text-left transition disabled:opacity-60 ${
                      actif
                        ? "border-signal bg-signal-light"
                        : "border-line hover:border-signal"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold text-ink">
                        {info?.label ?? mode}
                      </span>
                      {actif ? (
                        <span className="rounded-full bg-signal px-3 py-0.5 text-xs font-bold text-white">
                          Actif
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-ink-muted">
                          {saving === mode ? "…" : "Activer"}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">{info?.hint}</p>
                  </button>
                );
              })}
            </div>

            {/* Le quota SIV se compte à la journée : sans ce compteur, on
                découvre la limite le jour où la recherche cesse de
                répondre. */}
            <div className="mt-6 border-t border-line pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Appels aujourd&apos;hui
              </p>
              <div className="mt-2 flex gap-6 text-sm">
                <span className="text-ink">
                  SIV{" "}
                  <strong>{plate.usage_today.siv ?? 0}</strong>
                  <span className="text-ink-muted"> / ~100 par jour</span>
                </span>
                <span className="text-ink">
                  Midas <strong>{plate.usage_today.midas ?? 0}</strong>
                </span>
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                Les réponses en cache ne comptent pas : une même plaque
                cherchée deux fois dans la journée n&apos;appelle
                qu&apos;une fois le fournisseur.
              </p>
            </div>

            {/* « Service indisponible » côté client ne dit pas pourquoi.
                Ce test interroge les deux fournisseurs depuis le serveur
                et rapporte leurs réponses telles quelles. */}
            <div className="mt-6 border-t border-line pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Tester une plaque
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Interroge les deux fournisseurs, quel que soit le mode
                actif, et ignore le cache. Consomme un appel de quota
                par fournisseur.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  value={testPlate}
                  onChange={(e) => setTestPlate(e.target.value.toUpperCase())}
                  placeholder="AA-123-AA"
                  aria-label="Plaque à tester"
                  className="h-10 w-48 rounded-lg border border-line bg-paper px-3 font-mono text-sm text-ink outline-none focus:border-signal"
                />
                <button
                  onClick={runTest}
                  disabled={testing || testPlate.trim().length < 4}
                  className="rounded-lg bg-ink px-4 text-sm font-bold text-paper transition hover:bg-signal disabled:opacity-50"
                >
                  {testing ? "…" : "Tester"}
                </button>
              </div>

              {results && (
                <ul className="mt-4 space-y-2">
                  {results.map((r) => (
                    <li
                      key={r.provider}
                      className={`rounded-lg border p-3 text-xs ${
                        r.ok
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-line bg-paper-dim"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-ink">
                          {r.provider}
                        </span>
                        <span
                          className={
                            r.ok ? "font-bold text-emerald-700" : "text-ink-muted"
                          }
                        >
                          {r.ok ? "répond" : "échec"}
                        </span>
                      </div>
                      {r.dimensions && r.dimensions.length > 0 && (
                        <p className="mt-1 font-mono text-ink-soft">
                          {r.dimensions.join(" · ")}
                        </p>
                      )}
                      {r.error && (
                        <p className="mt-1 text-ink-soft">{r.error}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
