// Bandeau d'alerte d'impact croisé entre calculateurs.
// Indique à l'utilisateur quels autres écrans / résultats sont influencés
// quand il modifie une valeur dans le calculateur courant.

import { Link } from "@tanstack/react-router";
import { ArrowRight, Zap } from "lucide-react";
import { HelpDot } from "@/components/calculators/CalcUI";

export type CalculatorKey =
  | "tax-global"
  | "income-tax"
  | "source-tax"
  | "cross-border"
  | "tou"
  | "pillar3a"
  | "lpp"
  | "vested-benefits"
  | "retirement"
  | "avs-ai"
  | "health-insurance-france"
  | "health-insurance-resident"
  | "canton-compare"
  | "director-compensation"
  | "investment-compare"
  | "overtime";

interface ImpactTarget {
  to: CalculatorKey;
  what: string;
}

interface ImpactConfig {
  fields: string[];
  targets: ImpactTarget[];
}

const ROUTE_MAP: Record<CalculatorKey, string> = {
  "tax-global": "/calculators/tax-global",
  "income-tax": "/calculators/income-tax",
  "source-tax": "/calculators/source-tax",
  "cross-border": "/calculators/cross-border",
  tou: "/calculators/tou",
  pillar3a: "/calculators/pillar3a",
  lpp: "/calculators/lpp",
  "vested-benefits": "/calculators/vested-benefits",
  retirement: "/calculators/retirement",
  "avs-ai": "/calculators/avs-ai",
  "health-insurance-france": "/calculators/health-insurance-france",
  "health-insurance-resident": "/calculators/health-insurance-resident",
  "canton-compare": "/calculators/canton-compare",
  "director-compensation": "/calculators/director-compensation",
  "investment-compare": "/calculators/investment-compare",
  overtime: "/calculators/overtime",
};

const LABELS: Record<CalculatorKey, string> = {
  "tax-global": "Calculateur fiscal global",
  "income-tax": "Impôt sur le revenu",
  "source-tax": "Impôt à la source",
  "cross-border": "Frontalier",
  tou: "TOU / Quasi-résident",
  pillar3a: "3e pilier A",
  lpp: "LPP / 2e pilier",
  "vested-benefits": "Libre passage",
  retirement: "Retraite",
  "avs-ai": "AVS / AI",
  "health-insurance-france": "LAMal / CMU",
  "health-insurance-resident": "Caisse maladie résident",
  "canton-compare": "Comparateur cantons",
  "director-compensation": "Rémunération dirigeant",
  "investment-compare": "Comparateur placements",
  overtime: "Heures supplémentaires",
};

const IMPACT_MAP: Record<CalculatorKey, ImpactConfig> = {
  "tax-global": {
    fields: ["3a", "rachat LPP", "3b", "primes santé", "frontalier"],
    targets: [
      { to: "pillar3a", what: "Plafond 2026 et capital retraite projeté." },
      { to: "lpp", what: "Capacité de rachat et capital final." },
      { to: "retirement", what: "Revenu net à la retraite cumulé." },
      { to: "tou", what: "Éligibilité quasi-résident pour appliquer les déductions." },
    ],
  },
  "income-tax": {
    fields: ["revenu", "déductions", "canton"],
    targets: [
      { to: "tax-global", what: "Vue consolidée IFD + cantonal + santé." },
      { to: "canton-compare", what: "Gain potentiel d'un déménagement." },
    ],
  },
  "source-tax": {
    fields: ["salaire mensuel", "barème", "enfants"],
    targets: [
      { to: "tou", what: "Comparer IS retenue vs taxation ordinaire avec déductions." },
      { to: "tax-global", what: "Net annuel consolidé." },
    ],
  },
  "cross-border": {
    fields: ["brut CHF", "taux EUR/CHF", "LAMal"],
    targets: [
      { to: "tax-global", what: "Part suisse + part étrangère + charges santé." },
      { to: "health-insurance-france", what: "Choix de couverture optimal." },
    ],
  },
  tou: {
    fields: ["revenu mondial", "déductions effectives"],
    targets: [
      { to: "tax-global", what: "Bascule TOU vs source dans le scénario projeté." },
      { to: "source-tax", what: "Retenue mensuelle de référence." },
    ],
  },
  pillar3a: {
    fields: ["versement annuel", "rendement"],
    targets: [
      { to: "tax-global", what: "Économie d'impôt annuelle dans le comparateur." },
      { to: "retirement", what: "Capital 3a cumulé à la retraite." },
    ],
  },
  lpp: {
    fields: ["rachat", "salaire assuré", "âge"],
    targets: [
      { to: "tax-global", what: "Effet déductible du rachat sur l'impôt total." },
      { to: "retirement", what: "Capital LPP final et rente projetée." },
      { to: "vested-benefits", what: "Avoirs à fusionner ou répartir." },
    ],
  },
  "vested-benefits": {
    fields: ["capital", "stratégie de retrait"],
    targets: [
      { to: "tax-global", what: "Impact du retrait en capital sur l'année fiscale." },
      { to: "retirement", what: "Capital total disponible à la retraite." },
    ],
  },
  retirement: {
    fields: ["âge cible", "rendements", "rachats"],
    targets: [
      { to: "lpp", what: "Cohérence du capital LPP de départ." },
      { to: "pillar3a", what: "Cohérence des versements annuels." },
      { to: "avs-ai", what: "Rente AVS attendue à 65 ans." },
    ],
  },
  "avs-ai": {
    fields: ["années cotisées", "revenu moyen"],
    targets: [
      { to: "retirement", what: "Composante rente AVS dans le revenu projeté." },
      { to: "tax-global", what: "Rente AVS dans les autres revenus imposables." },
    ],
  },
  "health-insurance-france": {
    fields: ["primes LAMal", "revenu fiscal FR"],
    targets: [
      { to: "cross-border", what: "Charges santé dans le net annuel." },
      { to: "tax-global", what: "Tuile charges sociales du résultat." },
    ],
  },
  "canton-compare": {
    fields: ["revenu", "fortune", "statut civil"],
    targets: [
      { to: "tax-global", what: "Simuler le canton retenu en détail." },
      { to: "income-tax", what: "Détail IFD + cantonal." },
    ],
  },
  "director-compensation": {
    fields: ["salaire", "dividende", "bonus"],
    targets: [
      { to: "tax-global", what: "Impôt total selon le mix retenu." },
      { to: "lpp", what: "Cotisations LPP générées par la part salaire." },
    ],
  },
  "investment-compare": {
    fields: ["montant", "horizon", "rendement"],
    targets: [
      { to: "retirement", what: "Capital projeté toutes enveloppes confondues." },
      { to: "pillar3a", what: "Comparer au rendement 3a." },
    ],
  },
  overtime: {
    fields: ["heures", "taux horaire"],
    targets: [
      { to: "tax-global", what: "Salaire brut total après heures sup." },
    ],
  },
  "health-insurance-resident": {
    fields: [],
    targets: [],
  },
};

interface Props {
  calculator: CalculatorKey;
  clientId?: string;
}

export function CrossCalcImpactBanner({ calculator, clientId }: Props) {
  const cfg = IMPACT_MAP[calculator];
  if (!cfg || cfg.targets.length === 0) return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
      <div className="flex items-start gap-2">
        <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <strong className="text-foreground">Impact croisé.</strong>
            <span className="text-muted-foreground">
              Toute modification ici ({cfg.fields.join(", ")}) peut faire bouger ces écrans :
            </span>
            <HelpDot tip="Après modification d'un champ, ouvrez les calculateurs liés ci-dessous pour voir la valeur recalculée. La fiche client agrège tous les résultats." />
          </div>
          <ul className="flex flex-wrap gap-2">
            {cfg.targets.map((t) => (
              <li key={t.to}>
                <Link
                  to={ROUTE_MAP[t.to]}
                  search={clientId ? { clientId } : undefined}
                  className="group inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground/80 transition hover:border-primary hover:bg-primary/10 hover:text-primary"
                >
                  <span className="font-semibold">{LABELS[t.to]}</span>
                  <span className="opacity-70">· {t.what}</span>
                  <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
