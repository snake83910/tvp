"use client";

import { useEffect, useState } from "react";
import {
  adminApi,
  type CronRunStatus,
  type InstallmentsSetting,
  type PlateProviderSetting,
  type PlateTestResult,
} from "@/lib/admin";
import { useToast } from "@/components/admin/Toast";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

/** Ce que fait chaque job, et ce qu'il déclenche. Lancer « dunning » à
 *  la main peut annuler des commandes et envoyer des emails : l'écran
 *  doit le dire avant, pas après. */
const JOB_INFO: Record<string, { label: string; effet: string }> = {
  dunning: {
    label: "Relances de paiement",
    effet:
      "Vérifie les paiements auprès de la banque, relance par email les " +
      "commandes en attente, et annule celles de plus de 7 jours dont la " +
      "banque confirme qu'elles n'ont rien encaissé.",
  },
  appointments: {
    label: "Rappels de rendez-vous",
    effet:
      "Envoie les rappels de montage de la veille et les alertes « pneus " +
      "pas encore expédiés ».",
  },
  reviews: {
    label: "Demandes d'avis",
    effet:
      "Envoie une demande d'avis aux clients livrés en garage il y a plus " +
      "de deux jours.",
  },
  purge: {
    label: "Purge des données périmées",
    effet:
      "Supprime les journaux de connexion, jetons de session et paniers " +
      "anonymes hors délai de conservation. Irréversible.",
  },
};

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
  const [alma, setAlma] = useState<InstallmentsSetting | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testPlate, setTestPlate] = useState("");
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<PlateTestResult[] | null>(null);
  const [jobs, setJobs] = useState<CronRunStatus[] | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [confirmJob, setConfirmJob] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getPlateProvider()
      .then(setPlate)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"));
    adminApi.getCronRuns().then(setJobs).catch(() => setJobs([]));
    adminApi.getInstallments().then(setAlma).catch(() => setAlma(null));
  }, []);

  async function toggleAlma(enabled: boolean) {
    setSaving("alma");
    try {
      setAlma(await adminApi.setInstallments(enabled));
      toast(
        enabled
          ? "Paiement en plusieurs fois activé"
          : "Paiement en plusieurs fois désactivé",
        "success",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setSaving(null);
    }
  }

  async function launch(job: string) {
    setRunning(job);
    try {
      const { result } = await adminApi.runCronJob(job);
      // Le compte rendu du job EST le retour utile : « 3 relancées »
      // vaut mieux qu'un « terminé » qui ne dit rien.
      toast(
        `${JOB_INFO[job]?.label ?? job} : ${Object.entries(result)
          .map(([k, v]) => `${k} ${v}`)
          .join(", ")}`,
        "success",
      );
      setJobs(await adminApi.getCronRuns());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setRunning(null);
    }
  }

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

      {/* Paiement en plusieurs fois. Interrupteur et non variable
          d'environnement : le jour où quelque chose cloche chez Alma un
          samedi après-midi, il faut pouvoir l'éteindre depuis le
          navigateur, sans redéploiement. */}
      <section className="mt-8 rounded-2xl border border-line bg-paper p-6 shadow-card">
        <h2 className="font-display text-lg font-black text-ink">
          Paiement en plusieurs fois
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Propose le règlement en 3 ou 4 fois par Alma sur la page de
          paiement. Alma vous règle l&apos;intégralité à la commande et se
          fait rembourser par le client.
        </p>

        {!alma ? (
          <p className="mt-4 text-sm text-ink-muted">Chargement…</p>
        ) : (
          <>
            {!alma.configured && (
              <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                <strong>Clé d&apos;API absente.</strong> Ouvrez un compte sur
                alma.eu, puis renseignez <code>ALMA_API_KEY</code> dans le{" "}
                <code>.env</code> du serveur. L&apos;activation reste refusée
                tant qu&apos;elle manque — un bouton « payer en 3 fois » qui
                mène à une erreur coûte la vente.
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-4">
              <button
                type="button"
                role="switch"
                aria-checked={alma.enabled}
                disabled={saving === "alma" || !alma.configured}
                onClick={() => toggleAlma(!alma.enabled)}
                className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-40 ${
                  alma.enabled ? "bg-ok" : "bg-line"
                }`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                    alma.enabled ? "left-7" : "left-1"
                  }`}
                />
              </button>
              <div>
                <p className="font-semibold text-ink">
                  {alma.enabled ? "Activé" : "Désactivé"}
                </p>
                <p className="text-xs text-ink-muted">
                  Échéanciers proposés : {alma.installments.join(" et ")} fois ·
                  environnement <strong>{alma.mode}</strong>
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-ink-muted">
              Alma vérifie l&apos;éligibilité montant par montant : sous son
              plancher ou au-dessus de son plafond contractuel, l&apos;option
              ne s&apos;affiche pas, même activée.
            </p>
          </>
        )}
      </section>

      {/* Tâches planifiées : le crontab du serveur les lance seul, mais
          pouvoir en déclencher une à la main évite d'attendre l'heure
          suivante pour vérifier un correctif, ou de perdre une nuit
          sautée. */}
      <section className="mt-8 rounded-2xl border border-line bg-paper p-6 shadow-card">
        <h2 className="font-display text-lg font-black text-ink">
          Tâches planifiées
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Lancées automatiquement par le serveur. Une exécution manuelle
          fait exactement la même chose, et se voit ensuite dans
          « dernière exécution ».
        </p>

        {!jobs ? (
          <p className="mt-4 text-sm text-ink-muted">Chargement…</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {jobs.map((j) => {
              const info = JOB_INFO[j.job];
              const ko = j.state !== "ok";
              return (
                <li
                  key={j.job}
                  className={`rounded-xl border p-4 ${
                    ko ? "border-red-300 bg-red-50" : "border-line"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-ink">
                        {info?.label ?? j.job}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {info?.effet}
                      </p>
                      <p
                        className={`mt-1 text-xs ${
                          ko ? "font-semibold text-red-800" : "text-ink-muted"
                        }`}
                      >
                        {j.state === "never_ran"
                          ? "jamais exécutée"
                          : j.state === "late"
                            ? `en retard — dernière exécution ${new Date(j.last_run!).toLocaleString("fr-FR")}`
                            : j.state === "error"
                              ? `en erreur — ${String(j.detail?.error ?? "").slice(0, 120)}`
                              : `dernière exécution ${new Date(j.last_run!).toLocaleString("fr-FR")}`}
                      </p>
                    </div>
                    <button
                      onClick={() => setConfirmJob(j.job)}
                      disabled={running !== null}
                      className="shrink-0 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal disabled:opacity-50"
                    >
                      {running === j.job ? "En cours…" : "Exécuter"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={confirmJob !== null}
        title={`Exécuter « ${JOB_INFO[confirmJob ?? ""]?.label ?? confirmJob} » ?`}
        message={
          (JOB_INFO[confirmJob ?? ""]?.effet ?? "") +
          " L'exécution est immédiate et ne peut pas être interrompue."
        }
        confirmLabel="Exécuter maintenant"
        danger
        onClose={() => setConfirmJob(null)}
        onConfirm={() => {
          const job = confirmJob;
          setConfirmJob(null);
          if (job) launch(job);
        }}
      />
    </div>
  );
}
