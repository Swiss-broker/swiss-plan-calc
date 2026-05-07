import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Coins,
  Wallet,
  Landmark,
  PiggyBank,
  Map,
  TrendingUp,
  Globe,
  Scale,
  ShieldCheck,
  HeartHandshake,
  Building2,
  ArrowRight,
} from "lucide-react";
import { CalcCard } from "@/components/calculators/CalcUI";

export const Route = createFileRoute("/_app/calculators/")({
  head: () => ({ meta: [{ title: "Calculateurs · SwissBroker Pro" }] }),
  component: CalculatorsIndex,
});

const ITEMS = [
  {
    to: "/calculators/avs-ai" as const,
    icon: HeartHandshake,
    title: "1er pilier AVS/AI",
    desc: "Estimation rente individuelle ou couple, AVS21, plafonnement 3'780 CHF/mois.",
  },
  {
    to: "/calculators/lpp" as const,
    icon: Landmark,
    title: "2e pilier LPP & rachats",
    desc: "Projection capital retraite, plan de rachat étalé, économie fiscale.",
  },
  {
    to: "/calculators/pillar3a" as const,
    icon: PiggyBank,
    title: "3e pilier A & B",
    desc: "3a (déductible, plafond 7'258 CHF) et 3b (libre, non déductible). Projection et retrait étalé.",
  },
  {
    to: "/calculators/vested-benefits" as const,
    icon: ShieldCheck,
    title: "Libre passage",
    desc: "Stratégies sécurité / équilibre / dynamique, projection nette frais et impôts.",
  },
  {
    to: "/calculators/cross-border" as const,
    icon: Globe,
    title: "Frontaliers FR / IT",
    desc: "Régime 4.5 % (8 cantons), Genève spécifique, accord italo-suisse Tessin 2023.",
  },
  {
    to: "/calculators/income-tax" as const,
    icon: Coins,
    title: "Impôt revenu & fortune",
    desc: "IFD + ICC tous cantons, déductions standard suisses, taux marginal & effectif.",
  },
  {
    to: "/calculators/source-tax" as const,
    icon: Wallet,
    title: "Impôt à la source",
    desc: "Barèmes A / B / C / H 2026 + frontaliers France (4.5 %).",
  },
  {
    to: "/calculators/tou" as const,
    icon: Scale,
    title: "TOU / quasi-résident",
    desc: "Éligibilité 90 % et comparatif IS retenue vs taxation ordinaire ultérieure.",
  },
  {
    to: "/calculators/retirement" as const,
    icon: TrendingUp,
    title: "Rente vs capital",
    desc: "Compare rente LPP à vie ou retrait en capital + placement.",
  },
  {
    to: "/calculators/director-compensation" as const,
    icon: Building2,
    title: "Salaire / dividende dirigeant",
    desc: "Comparateur de stratégies de rémunération pour dirigeants Sàrl/SA : salaire, dividendes, réserves.",
  },
  {
    to: "/calculators/canton-compare" as const,
    icon: Map,
    title: "Comparateur cantonal",
    desc: "Compare votre charge fiscale dans les 6 cantons romands (+ Zoug en référence) en un clic.",
  },
];

function CalculatorsIndex() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ITEMS.map((it) => (
        <Link key={it.to} to={it.to} className="group">
          <CalcCard className="h-full transition-all hover:border-primary/40 hover:shadow-elegant">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <it.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold tracking-tight">{it.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{it.desc}</p>
            <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Ouvrir <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </CalcCard>
        </Link>
      ))}
    </div>
  );
}
