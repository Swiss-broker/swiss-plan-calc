// Comparateur "Avant / Après" pour le Calculateur Fiscal Global.
//
// Logique :
// - Base de comparaison = snapshot figé du formulaire (capturé à l'ouverture
//   ou via le bouton "Définir comme base").
// - Situation simulée = formulaire actuel, en direct.
// - Le bloc affiche l'impact réel des modifications de l'utilisateur :
//   économie/surcoût d'impôt, charges santé, net annuel, taux effectif et
//   marginal. La liste des champs modifiés est affichée pour rendre
//   l'impact compréhensible.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Camera, RotateCcw, ArrowRight as ArrowRightIcon } from "lucide-react";

import { CalcCard } from "@/components/calculators/CalcUI";
import {
  SplitCompareLayout,
  type SplitRow,
} from "@/components/calculators/SplitCompareLayout";
import { Button } from "@/components/ui/button";

import { formatCHF } from "@/lib/format";
import { computeTaxGlobal } from "@/lib/tax-global/engine";
import {
  computeFieldSensitivities,
  type FieldSensitivity,
  type PostBreakdown,
} from "@/lib/tax-global/sensitivities";
import type { TaxGlobalInput, TaxGlobalResult } from "@/lib/tax-global/types";


interface Props {
  form: TaxGlobalInput;
  result: TaxGlobalResult;
  /** Identifiant client : si présent, la base est resynchronisée au changement. */
  clientId?: string;
}

// Champs numériques surveillés pour détecter une modification utilisateur.
const NUMERIC_FIELDS: Array<keyof TaxGlobalInput> = [
  "grossSalary",
  "bonus",
  "spouseGrossSalary",
  "otherIncome",
  "rentalIncome",
  "imputedRent",
  "foreignIncome",
  "netWealth",
  "pillar3aContributions",
  "pillar3bContributions",
  "lppBuyback",
  "mortgageInterest",
  "realEstateMaintenance",
  "healthInsurancePremiums",
  "childCareCosts",
  "donations",
  "children",
];

const CATEGORICAL_FIELDS: Array<keyof TaxGlobalInput> = [
  "canton",
  "countryOfResidence",
  "permit",
  "civilStatus",
  "confession",
  "spouseEmployed",
];

const FIELD_LABEL: Partial<Record<keyof TaxGlobalInput, string>> = {
  grossSalary: "Salaire brut",
  bonus: "Bonus",
  spouseGrossSalary: "Salaire brut conjoint",
  otherIncome: "Autres revenus",
  rentalIncome: "Revenus locatifs",
  imputedRent: "Valeur locative",
  foreignIncome: "Revenus étrangers",
  netWealth: "Fortune nette",
  pillar3aContributions: "3e pilier A",
  pillar3bContributions: "3e pilier B",
  lppBuyback: "Rachat LPP",
  mortgageInterest: "Intérêts hypothécaires",
  realEstateMaintenance: "Entretien immobilier",
  healthInsurancePremiums: "Primes santé",
  childCareCosts: "Frais de garde",
  donations: "Dons",
  children: "Nombre d'enfants",
  canton: "Canton",
  countryOfResidence: "Pays de résidence",
  permit: "Permis",
  civilStatus: "Statut civil",
  confession: "Confession",
  spouseEmployed: "Conjoint actif",
};

interface FieldDiff {
  key: keyof TaxGlobalInput;
  label: string;
  before: string;
  after: string;
  delta?: number;
}

function fmtVal(v: unknown): string {
  if (typeof v === "number") return formatCHF(v);
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  return String(v ?? "—");
}

function diffForms(base: TaxGlobalInput, curr: TaxGlobalInput): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const k of NUMERIC_FIELDS) {
    const a = Number(base[k] ?? 0);
    const b = Number(curr[k] ?? 0);
    if (a !== b) {
      diffs.push({
        key: k,
        label: FIELD_LABEL[k] ?? String(k),
        before: fmtVal(a),
        after: fmtVal(b),
        delta: b - a,
      });
    }
  }
  for (const k of CATEGORICAL_FIELDS) {
    if (base[k] !== curr[k]) {
      diffs.push({
        key: k,
        label: FIELD_LABEL[k] ?? String(k),
        before: fmtVal(base[k]),
        after: fmtVal(curr[k]),
      });
    }
  }
  return diffs;
}

export function TaxGlobalCompareCard({ form, result, clientId }: Props) {
  // Base de comparaison : snapshot initial du formulaire.
  const [baseline, setBaseline] = useState<TaxGlobalInput>(form);
  const initializedRef = useRef(false);
  const lastClientRef = useRef<string | undefined>(clientId);

  // Resynchroniser la base lorsqu'on change de client (prefill).
  useEffect(() => {
    if (lastClientRef.current !== clientId) {
      lastClientRef.current = clientId;
      setBaseline(form);
      initializedRef.current = true;
      return;
    }
    // Première hydratation : si la base est encore le default et le form a été
    // peuplé par le prefill, on resynchronise une seule fois.
    if (!initializedRef.current) {
      setBaseline(form);
      initializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, form.grossSalary, form.canton, form.permit, form.civilStatus]);

  const baselineResult = useMemo(() => computeTaxGlobal(baseline), [baseline]);

  const diffs = useMemo(() => diffForms(baseline, form), [baseline, form]);
  const hasChanges = diffs.length > 0;

  // Sensibilités : impact isolé de chaque champ sur chaque poste fiscal.
  const sensitivities = useMemo<FieldSensitivity[]>(() => {
    if (!hasChanges) return [];
    return computeFieldSensitivities(
      baseline,
      form,
      diffs.map((d) => d.key),
    );
  }, [baseline, form, diffs, hasChanges]);

  const ifdRow = (r: TaxGlobalResult): number =>
    r.income ? r.income.ifd : r.crossBorder?.swissTax ?? r.source?.annualTax ?? 0;
  const cantonalRow = (r: TaxGlobalResult): number =>
    r.income ? r.income.cantonal + r.income.communal : 0;
  const wealthRow = (r: TaxGlobalResult): number => r.income?.wealthTax ?? 0;

  // Helper : rend le panneau de causes pour un poste donné.
  const buildBreakdown = (postKey: keyof PostBreakdown): ReactNode => {
    if (sensitivities.length === 0) return null;
    const items = sensitivities
      .map((s) => ({
        key: s.key,
        label: FIELD_LABEL[s.key] ?? String(s.key),
        impact: s.delta[postKey],
      }))
      .filter((it) => typeof it.impact === "number");
    const significant = items.filter((it) => Math.abs(Number(it.impact)) >= 1);
    if (significant.length === 0) {
      return (
        <div className="text-muted-foreground">
          Aucun des champs modifiés n'agit directement sur cette ligne.
        </div>
      );
    }
    significant.sort(
      (a, b) => Math.abs(Number(b.impact)) - Math.abs(Number(a.impact)),
    );
    const isRate = postKey === "effectiveRate" || postKey === "marginalRate";
    return (
      <ul className="space-y-1">
        {significant.map((it) => {
          const val = Number(it.impact);
          const pos = val > 0;
          const formatted = isRate
            ? `${pos ? "+" : "−"}${Math.abs(val).toFixed(2)} pt`
            : `${pos ? "+" : "−"}${formatCHF(Math.abs(val))}`;
          return (
            <li
              key={String(it.key)}
              className="flex items-center justify-between gap-3"
            >
              <span className="text-foreground/80">{it.label}</span>
              <span
                className={
                  (pos
                    ? "text-destructive"
                    : "text-success") + " font-semibold tabular-nums"
                }
              >
                {formatted}
              </span>
            </li>
          );
        })}
      </ul>
    );
  };

  const rows: SplitRow[] = [
    {
      id: "total",
      label: "Impôt total annuel",
      current: baselineResult.totalTaxCHF,
      projected: result.totalTaxCHF,
      betterWhen: "lower",
      breakdown: buildBreakdown("total"),
    },
    {
      id: "ifd",
      label: "Impôt fédéral / source CH",
      current: ifdRow(baselineResult),
      projected: ifdRow(result),
      betterWhen: "lower",
      breakdown: buildBreakdown("ifd"),
    },
    ...(cantonalRow(baselineResult) > 0 || cantonalRow(result) > 0
      ? [
          {
            id: "cantonalCommunal",
            label: "Cantonal + communal",
            current: cantonalRow(baselineResult),
            projected: cantonalRow(result),
            betterWhen: "lower" as const,
            breakdown: buildBreakdown("cantonalCommunal"),
          },
        ]
      : []),
    ...(wealthRow(baselineResult) > 0 || wealthRow(result) > 0
      ? [
          {
            id: "wealth",
            label: "Impôt sur la fortune",
            current: wealthRow(baselineResult),
            projected: wealthRow(result),
            betterWhen: "lower" as const,
            breakdown: buildBreakdown("wealth"),
          },
        ]
      : []),
    ...(baselineResult.socialChargesCHF > 0 || result.socialChargesCHF > 0
      ? [
          {
            id: "health",
            label: "Charges santé (LAMal / CMU)",
            current: baselineResult.socialChargesCHF,
            projected: result.socialChargesCHF,
            betterWhen: "lower" as const,
            breakdown: buildBreakdown("health"),
          },
        ]
      : []),
    {
      id: "net",
      label: "Net annuel disponible",
      current: baselineResult.netAnnualCHF,
      projected: result.netAnnualCHF,
      betterWhen: "higher",
      breakdown: buildBreakdown("net"),
    },
    {
      id: "effectiveRate",
      label: "Taux effectif",
      current: baselineResult.effectiveRate / 100,
      projected: result.effectiveRate / 100,
      format: "pct",
      betterWhen: "lower",
      breakdown: buildBreakdown("effectiveRate"),
    },
    {
      id: "marginalRate",
      label: "Taux marginal",
      current: baselineResult.marginalRate / 100,
      projected: result.marginalRate / 100,
      format: "pct",
      betterWhen: "lower",
      breakdown: buildBreakdown("marginalRate"),
    },
  ];

  const annualSaving = baselineResult.totalTaxCHF - result.totalTaxCHF;
  const netGain = result.netAnnualCHF - baselineResult.netAnnualCHF;
  const deltaPct =
    baselineResult.totalTaxCHF > 0
      ? annualSaving / baselineResult.totalTaxCHF
      : 0;

  const regimeChanged = baselineResult.regime !== result.regime;
  const noEffect = result.regime === "cross_border_fr_1983";
  const needsTou =
    result.regime === "source_taxed" ||
    result.regime === "cross_border_ge" ||
    result.regime === "cross_border_other";

  return (
    <CalcCard
      title={`Comparateur fiscal · Avant / Après${hasChanges ? ` · ${diffs.length} modification${diffs.length > 1 ? "s" : ""}` : ""}`}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Comparez la situation de référence (base figée) avec la situation
        simulée en direct. Cliquez sur une pastille verte ou rouge pour voir
        quels champs précis ont produit l'écart.
      </p>

      {/* Barre d'actions base */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setBaseline(form)}
          className="gap-1.5"
        >
          <Camera className="h-3.5 w-3.5" />
          Définir comme base
        </Button>
        {hasChanges && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setBaseline(form)}
            className="gap-1.5 text-muted-foreground"
            title="Réinitialiser la base sur les valeurs actuelles"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Réinitialiser la base
          </Button>
        )}
      </div>

      {/* Liste des changements - grille tabulaire propre */}
      {hasChanges ? (
        <div className="mb-4 overflow-hidden rounded-lg border border-primary/30 bg-primary/5">
          <div className="border-b border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
            Changements simulés
          </div>
          <div className="divide-y divide-primary/10">
            {/* En-tête colonnes */}
            <div className="grid grid-cols-[1.2fr_1fr_auto_1fr_auto] items-center gap-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <div>Champ</div>
              <div className="text-right">Avant</div>
              <div />
              <div className="text-right">Après</div>
              <div className="text-right">Δ</div>
            </div>
            {diffs.map((d) => (
              <div
                key={String(d.key)}
                className="grid grid-cols-[1.2fr_1fr_auto_1fr_auto] items-center gap-3 px-3 py-1.5 text-xs"
              >
                <div className="font-medium text-foreground">{d.label}</div>
                <div className="text-right tabular-nums text-muted-foreground">
                  {d.before}
                </div>
                <ArrowRightIcon className="h-3 w-3 text-muted-foreground/60" />
                <div className="text-right font-semibold tabular-nums text-foreground">
                  {d.after}
                </div>
                <div className="text-right">
                  {typeof d.delta === "number" && d.delta !== 0 ? (
                    <span
                      className={
                        (d.delta > 0
                          ? "bg-success/15 text-success"
                          : "bg-destructive/15 text-destructive") +
                        " rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                      }
                    >
                      {d.delta > 0 ? "+" : "−"}
                      {formatCHF(Math.abs(d.delta))}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            ))}
            {regimeChanged && (
              <div className="grid grid-cols-[1.2fr_1fr_auto_1fr_auto] items-center gap-3 bg-primary/10 px-3 py-1.5 text-xs">
                <div className="font-semibold text-primary">Régime fiscal</div>
                <div className="text-right tabular-nums text-muted-foreground">
                  {baselineResult.regimeLabel}
                </div>
                <ArrowRightIcon className="h-3 w-3 text-primary/60" />
                <div className="col-span-2 text-right font-semibold tabular-nums text-primary">
                  {result.regimeLabel}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Aucune modification simulée. Modifiez un champ du formulaire (rachat
          LPP, 3a, canton, permis…) ou appliquez une optimisation détectée pour
          voir son impact ici.
        </div>
      )}



      {needsTou && hasChanges && (
        <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
          <strong>Démarche requise.</strong> Pour matérialiser l'économie il
          faut demander la TOU (quasi-résident, 90 % des revenus en CH) ou une
          rectification IS auprès de l'AFC avant le 31 mars de l'année
          suivante. Sans démarche, la retenue à la source brute s'applique.
        </div>
      )}
      {noEffect && hasChanges && (
        <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          <strong>Accord 1983.</strong> Imposition exclusive en France. Les
          déductions suisses (3a, rachat LPP, primes LAMal CH) n'ont aucun
          effet fiscal. L'écart affiché est informatif.
        </div>
      )}

      <SplitCompareLayout
        currentLabel="Avant modification"
        projectedLabel="Après modification"
        currentSubtitle="Base de comparaison (figée)"
        projectedSubtitle="Situation simulée en direct"
        rows={rows}
        legend={
          <span>
            Pastille verte : économie ou amélioration. Pastille rouge :
            surcoût. Pas de pastille = pas de changement.
          </span>
        }
        summary={{
          annualSaving,
          annualSavingLabel: "Économie d'impôt annuelle",
          retirementGain: netGain,
          retirementGainLabel: "Gain net annuel (cash en poche)",
          deltaPercent: deltaPct,
          deltaLabel: "Variation d'impôt",
          footnote: hasChanges ? (
            <span>
              Impact basé sur {diffs.length} modification
              {diffs.length > 1 ? "s" : ""} :{" "}
              {diffs
                .map((d) =>
                  typeof d.delta === "number" && d.delta !== 0
                    ? `${d.label} ${d.delta > 0 ? "+" : "−"}${formatCHF(Math.abs(d.delta))}`
                    : `${d.label} (${d.before} → ${d.after})`,
                )
                .join(", ")}
              .
            </span>
          ) : (
            <span>
              Les deux colonnes sont identiques tant qu'aucune modification
              n'est saisie.
            </span>
          ),
        }}
      />

      {hasChanges && Math.abs(annualSaving) < 100 && (
        <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-xs">
          <div className="mb-2 font-semibold text-foreground">
            Pourquoi l'écart reste à zéro malgré vos modifications ?
          </div>

          {/* Causes transverses (régime / accord) */}
          {(noEffect || needsTou) && (
            <ul className="mb-3 space-y-1 text-muted-foreground">
              {noEffect && (
                <li>
                  • <strong className="text-foreground">Accord franco-suisse 1983</strong> :
                  imposition exclusive en France. Aucune déduction CH (3a, rachat
                  LPP, primes LAMal CH) n'est opposable au fisc français.
                </li>
              )}
              {needsTou && (
                <li>
                  • <strong className="text-foreground">Régime à la source sans TOU</strong> :
                  la retenue brute s'applique. Les déductions n'ont d'effet
                  qu'après dépôt d'une demande TOU (quasi-résident) ou d'une
                  rectification IS auprès de l'AFC.
                </li>
              )}
              {result.regime === "source_taxed" &&
                result.touComparison &&
                result.touComparison.ordinaryTax >=
                  (result.source?.annualTax ?? 0) && (
                  <li>
                    • <strong className="text-foreground">TOU non avantageuse</strong> :
                    la taxation ordinaire avec déductions reste plus coûteuse
                    que la retenue à la source actuelle.
                  </li>
                )}
            </ul>
          )}

          {/* Explication champ par champ */}
          <div className="mb-1.5 font-semibold text-foreground">
            Détail par champ modifié
          </div>
          <ul className="space-y-1.5 text-muted-foreground">
            {diffs.map((d) => {
              const reason = explainFieldNoImpact(d, {
                form,
                baseline,
                regime: result.regime,
                noEffect,
                needsTou,
                touUseless:
                  result.regime === "source_taxed" &&
                  !!result.touComparison &&
                  result.touComparison.ordinaryTax >=
                    (result.source?.annualTax ?? 0),
              });
              return (
                <li key={`why-${String(d.key)}`}>
                  <span className="font-medium text-foreground">{d.label}</span>{" "}
                  <span className="text-foreground/60">
                    ({d.before} → {d.after})
                  </span>{" "}
                  : {reason}
                </li>
              );
            })}
            {regimeChanged && (
              <li>
                <span className="font-medium text-foreground">Régime fiscal</span>{" "}
                <span className="text-foreground/60">
                  ({baselineResult.regimeLabel} → {result.regimeLabel})
                </span>{" "}
                : le nouveau régime conduit à un impôt total quasi équivalent
                (différence inférieure à 100 CHF).
              </li>
            )}
          </ul>

          <div className="mt-3 border-t border-border pt-2 text-foreground/70">
            Astuce : une modification peut affecter uniquement les charges
            santé, le net cash ou le taux marginal sans déplacer l'impôt total.
            Vérifiez chaque ligne du comparateur ci-dessus.
          </div>
        </div>
      )}
    </CalcCard>
  );
}

/** Contexte transverse pour expliquer pourquoi un champ ne déplace pas l'impôt. */
interface ExplainCtx {
  form: TaxGlobalInput;
  baseline: TaxGlobalInput;
  regime: TaxGlobalResult["regime"];
  noEffect: boolean;
  needsTou: boolean;
  touUseless: boolean;
}

/** Plafond légal 2026 utilisé dans la note (aligné sur PILLAR_3A_MAX_2026_LPP). */
const PILLAR_3A_CAP_LPP = 7_258;

function explainFieldNoImpact(d: FieldDiff, ctx: ExplainCtx): string {
  const { form, regime, noEffect, needsTou, touUseless } = ctx;

  if (noEffect) {
    return "déduction non opposable au fisc français (accord 1983) : aucun effet sur l'impôt.";
  }

  switch (d.key) {
    case "pillar3aContributions": {
      const after = Number(form.pillar3aContributions ?? 0);
      if (after >= PILLAR_3A_CAP_LPP) {
        return `plafond légal déjà atteint (${formatCHF(PILLAR_3A_CAP_LPP)}). Toute cotisation supplémentaire n'est plus déductible.`;
      }
      if (needsTou)
        return "régime à la source : la cotisation 3a n'est déduite qu'après demande TOU ou rectification IS.";
      if (touUseless)
        return "la TOU avec 3a reste plus coûteuse que la retenue à la source : aucune économie.";
      return "effet marginal trop faible pour modifier l'impôt total (tranche fiscale inchangée).";
    }
    case "lppBuyback": {
      const cap = form.lppBuybackCapacity ?? 0;
      const after = Number(form.lppBuyback ?? 0);
      if (cap === 0)
        return "aucune capacité de rachat LPP renseignée sur la fiche client : le moteur ne peut pas valider la déduction.";
      if (after > cap)
        return `montant supérieur à la capacité disponible (${formatCHF(cap)}) : la déduction est plafonnée.`;
      if (needsTou)
        return "régime à la source : le rachat LPP n'est déduit qu'après TOU ou rectification IS.";
      if (touUseless)
        return "même avec le rachat, la taxation ordinaire reste plus coûteuse que la retenue à la source.";
      return "rachat valide mais déjà absorbé par les déductions existantes (tranche fiscale inchangée).";
    }
    case "pillar3bContributions":
      return "le 3e pilier B est plafonné dans le forfait cantonal d'assurances : le plafond est probablement déjà atteint avec les primes santé.";
    case "healthInsurancePremiums":
      if (regime === "resident_ordinary")
        return "primes plafonnées au forfait cantonal d'assurances : au-delà du plafond, la déduction supplémentaire est ignorée.";
      if (needsTou)
        return "frontalier / source : les primes CH ne sont déductibles qu'après TOU ou rectification IS.";
      return "déduction plafonnée par le forfait cantonal d'assurances.";
    case "mortgageInterest":
    case "realEstateMaintenance":
      if (regime !== "resident_ordinary")
        return "déduction immobilière non applicable hors taxation ordinaire (source/frontalier).";
      return "effet présent mais inférieur à 100 CHF d'économie d'impôt (tranche inchangée).";
    case "childCareCosts":
      return "frais de garde plafonnés (IFD : 25 500 CHF/enfant) et soumis au plafond cantonal : le plafond est probablement déjà atteint.";
    case "donations":
      if (regime !== "resident_ordinary" && regime !== "tou")
        return "dons déductibles uniquement en taxation ordinaire (résident ou TOU activée).";
      return "don déductible mais effet marginal inférieur à 100 CHF sur le total.";
    case "netWealth":
      if (regime !== "resident_ordinary")
        return "impôt sur la fortune non applicable hors résident ordinaire (source/frontalier).";
      return "variation insuffisante pour franchir un seuil d'imposition fortune.";
    case "imputedRent":
      return "valeur locative incluse dans l'impôt mais souvent neutralisée par les déductions hypothécaires.";
    case "foreignIncome":
      return "revenu étranger non pris en compte dans le calcul automatique (à reporter manuellement pour la progressivité).";
    case "grossSalary":
    case "bonus":
    case "spouseGrossSalary":
    case "otherIncome":
    case "rentalIncome":
      if (needsTou)
        return "variation de revenu mais la retenue source proportionnelle compense quasi exactement.";
      return "variation présente mais inférieure à 100 CHF d'écart d'impôt total (tranche inchangée).";
    case "canton":
      return "le nouveau canton produit un impôt cantonal+communal très proche : la différence reste inférieure à 100 CHF.";
    case "permit":
      return "le changement de permis ne fait pas basculer de régime fiscal applicable dans ce cas.";
    case "civilStatus":
      return "le barème applicable reste équivalent (concubinage = célibataire ; marié vs partenariat enregistré identiques).";
    case "spouseEmployed":
      return "le barème conjoint actif vs non actif produit ici un impôt très proche.";
    case "confession":
      return "impôt ecclésiastique non significatif dans ce canton ou ce régime.";
    case "children":
      return "déductions enfants déjà appliquées : la variation est intégrée mais reste inférieure à 100 CHF.";
    default:
      return "modification prise en compte mais effet inférieur à 100 CHF sur l'impôt total.";
  }
}
