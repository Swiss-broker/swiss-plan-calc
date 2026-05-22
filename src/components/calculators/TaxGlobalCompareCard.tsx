// Comparateur Actuel vs Projeté pour le Calculateur Fiscal Global.
// Calcule un scénario "optimisé" en cumulant les leviers fiscaux principaux
// (3a au plafond, rachat LPP étalé, 3b cantonal, frais santé au forfait),
// puis affiche les deux scénarios côte à côte via SplitCompareLayout.

import { useMemo } from "react";

import { CalcCard, HelpDot } from "@/components/calculators/CalcUI";
import {
  SplitCompareLayout,
  type SplitRow,
} from "@/components/calculators/SplitCompareLayout";
import { Badge } from "@/components/ui/badge";
import { formatCHF } from "@/lib/format";
import { computeTaxGlobal } from "@/lib/tax-global/engine";
import type { TaxGlobalInput, TaxGlobalResult } from "@/lib/tax-global/types";
import {
  PILLAR_3A_MAX_2026_LPP,
  PILLAR_3A_MAX_2026_NO_LPP,
} from "@/lib/tax/income";

interface Props {
  form: TaxGlobalInput;
  result: TaxGlobalResult;
}

const DEFAULT_3B_TARGET = 3_500;
const HEALTH_FORFAIT_DEFAULT = 3_500;

export function TaxGlobalCompareCard({ form, result }: Props) {
  const hasLPP = !(form.permit === "G" && result.regime === "cross_border_fr_1983");
  const target3a = hasLPP ? PILLAR_3A_MAX_2026_LPP : PILLAR_3A_MAX_2026_NO_LPP;

  const lppCapacity = form.lppBuybackCapacity ?? 0;
  const isCouple =
    form.civilStatus === "married" || form.civilStatus === "registered_partnership";
  const gross =
    form.grossSalary + form.bonus + (isCouple ? form.spouseGrossSalary : 0);
  const targetLppBuyback = Math.min(
    lppCapacity,
    Math.max(0, Math.round((gross * 0.25) / 1000) * 1000),
  );
  const targetLppYearly = targetLppBuyback > 0 ? Math.round(targetLppBuyback / 3) : 0;

  const target3b = Math.max(form.pillar3bContributions, DEFAULT_3B_TARGET);
  const targetHealth = Math.max(form.healthInsurancePremiums, HEALTH_FORFAIT_DEFAULT);

  const projectedForm: TaxGlobalInput = useMemo(
    () => ({
      ...form,
      pillar3aContributions: Math.max(form.pillar3aContributions, target3a),
      lppBuyback: Math.max(form.lppBuyback, targetLppYearly),
      pillar3bContributions: target3b,
      healthInsurancePremiums: targetHealth,
    }),
    [form, target3a, targetLppYearly, target3b, targetHealth],
  );

  const projected = useMemo(() => computeTaxGlobal(projectedForm), [projectedForm]);

  const delta3a = projectedForm.pillar3aContributions - form.pillar3aContributions;
  const deltaLpp = projectedForm.lppBuyback - form.lppBuyback;
  const delta3b = projectedForm.pillar3bContributions - form.pillar3bContributions;
  const deltaHealth =
    projectedForm.healthInsurancePremiums - form.healthInsurancePremiums;

  const annualSaving = result.totalTaxCHF - projected.totalTaxCHF;
  const netGain = projected.netAnnualCHF - result.netAnnualCHF;
  const deltaPct =
    result.totalTaxCHF > 0 ? annualSaving / result.totalTaxCHF : 0;

  const ifdRow = (r: TaxGlobalResult): number =>
    r.income ? r.income.ifd : r.crossBorder?.swissTax ?? r.source?.annualTax ?? 0;
  const cantonalRow = (r: TaxGlobalResult): number =>
    r.income ? r.income.cantonal + r.income.communal : 0;
  const wealthRow = (r: TaxGlobalResult): number => r.income?.wealthTax ?? 0;

  const rows: SplitRow[] = [
    {
      label: "Impôt total annuel",
      current: result.totalTaxCHF,
      projected: projected.totalTaxCHF,
      betterWhen: "lower",
    },
    {
      label: "Impôt fédéral / source CH",
      current: ifdRow(result),
      projected: ifdRow(projected),
      betterWhen: "lower",
    },
    ...(cantonalRow(result) > 0 || cantonalRow(projected) > 0
      ? [
          {
            label: "Cantonal + communal",
            current: cantonalRow(result),
            projected: cantonalRow(projected),
            betterWhen: "lower" as const,
          },
        ]
      : []),
    ...(wealthRow(result) > 0 || wealthRow(projected) > 0
      ? [
          {
            label: "Impôt sur la fortune",
            current: wealthRow(result),
            projected: wealthRow(projected),
            betterWhen: "lower" as const,
          },
        ]
      : []),
    ...(result.socialChargesCHF > 0 || projected.socialChargesCHF > 0
      ? [
          {
            label: "Charges santé (LAMal / CMU)",
            current: result.socialChargesCHF,
            projected: projected.socialChargesCHF,
            betterWhen: "lower" as const,
          },
        ]
      : []),
    {
      label: "Net annuel disponible",
      current: result.netAnnualCHF,
      projected: projected.netAnnualCHF,
      betterWhen: "higher",
    },
    {
      label: "Taux effectif",
      current: result.effectiveRate / 100,
      projected: projected.effectiveRate / 100,
      format: "pct",
      betterWhen: "lower",
    },
    {
      label: "Taux marginal",
      current: result.marginalRate / 100,
      projected: projected.marginalRate / 100,
      format: "pct",
      betterWhen: "lower",
    },
  ];

  const needsTou =
    result.regime === "source_taxed" ||
    result.regime === "cross_border_ge" ||
    result.regime === "cross_border_other";
  const noEffect = result.regime === "cross_border_fr_1983";

  return (
    <CalcCard
      title="Optimisations fiscales · Actuel vs Projeté"
      icon={TrendingUp}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="gap-1 bg-primary/5">
          Cible 3a : {formatCHF(target3a)}
          <HelpDot tip="Plafond légal 2026 du 3e pilier A. 7'258 CHF si affilié à une LPP, sinon 36'288 CHF (max 20 % du revenu net). Cotisation intégralement déductible du revenu imposable, capital bloqué jusqu'à la retraite (sortie possible 5 ans avant l'âge AVS)." />
        </Badge>
        {targetLppYearly > 0 && (
          <Badge variant="outline" className="gap-1 bg-primary/5">
            Rachat LPP : {formatCHF(targetLppYearly)} / an sur 3 ans
            <HelpDot tip="Capacité de rachat issue de la fiche client, plafonnée à 25 % du brut et étalée sur 3 ans pour maximiser le gain marginal sans tomber dans une tranche trop basse. Blocage de 3 ans avant tout retrait en capital (art. 79b LPP)." />
          </Badge>
        )}
        <Badge variant="outline" className="gap-1 bg-primary/5">
          Cible 3b : {formatCHF(target3b)}
          <HelpDot tip="3e pilier B (assurance-vie, épargne libre). Agrégé aux primes santé dans le plafond commun cantonal des frais d'assurance. Effet déductible variable selon le canton et le statut civil." />
        </Badge>
        {targetHealth > form.healthInsurancePremiums && (
          <Badge variant="outline" className="gap-1 bg-primary/5">
            Forfait santé : {formatCHF(targetHealth)}
            <HelpDot tip="Forfait cantonal indicatif appliqué pour les primes LAMal et LCA lorsqu'aucun montant n'est saisi. Valeur typique pour un célibataire à Genève." />
          </Badge>
        )}
      </div>

      {needsTou && (
        <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
          <strong>Démarche requise.</strong> Pour matérialiser ces économies il
          faut demander la TOU (quasi-résident, 90 % des revenus en CH) ou une
          rectification IS auprès de l'AFC avant le 31 mars de l'année suivante.
          Sans démarche, la retenue à la source brute s'applique et l'économie
          reste théorique.
        </div>
      )}
      {noEffect && (
        <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          <strong>Accord 1983.</strong> Imposition exclusive en France. Les
          déductions suisses (3a, rachat LPP, primes LAMal CH) n'ont aucun effet
          fiscal. Le scénario projeté est affiché à titre informatif uniquement.
        </div>
      )}

      <SplitCompareLayout
        currentSubtitle="Situation déclarée"
        projectedSubtitle="Avec leviers fiscaux activés"
        rows={rows}
        legend={
          <span>
            Pastille verte : économie obtenue par rapport à la situation
            actuelle. Pastille rouge : surcoût.
          </span>
        }
        summary={{
          annualSaving,
          annualSavingLabel: "Économie d'impôt annuelle",
          retirementGain: netGain,
          retirementGainLabel: "Gain net annuel (cash en poche)",
          deltaPercent: deltaPct,
          deltaLabel: "Réduction d'impôt",
          footnote: (
            <span>
              Décomposition des leviers projetés :
              {delta3a > 0 && <> 3a +{formatCHF(delta3a)},</>}
              {deltaLpp > 0 && <> rachat LPP +{formatCHF(deltaLpp)} / an,</>}
              {delta3b > 0 && <> 3b +{formatCHF(delta3b)},</>}
              {deltaHealth > 0 && <> santé +{formatCHF(deltaHealth)}.</>}
              {delta3a === 0 &&
                deltaLpp === 0 &&
                delta3b === 0 &&
                deltaHealth === 0 && (
                  <> aucun levier supplémentaire n'est applicable, la situation
                  actuelle est déjà optimisée.</>
                )}
            </span>
          ),
        }}
      />
    </CalcCard>
  );
}
