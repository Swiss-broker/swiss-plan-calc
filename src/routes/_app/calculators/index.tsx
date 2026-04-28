import { createFileRoute, Link } from "@tanstack/react-router";
import { Coins, Wallet, Landmark, PiggyBank, Map, TrendingUp, ArrowRight } from "lucide-react";
import { CalcCard } from "@/components/calculators/CalcUI";

export const Route = createFileRoute("/_app/calculators/")({
  head: () => ({ meta: [{ title: "Calculateurs · SwissBroker Pro" }] }),
  component: CalculatorsIndex,
});

const ITEMS = [
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
    to: "/calculators/lpp" as const,
    icon: Landmark,
    title: "LPP & rachats",
    desc: "Projection capital retraite, plan de rachat étalé, économie fiscale.",
  },
  {
    to: "/calculators/pillar3a" as const,
    icon: PiggyBank,
    title: "Pilier 3a",
    desc: "Maximum déductible 2026, projection capitalisation, retrait étalé.",
  },
  {
    to: "/calculators/canton-compare" as const,
    icon: Map,
    title: "Comparateur cantonal",
    desc: "Compare votre charge fiscale dans les 26 cantons en un clic.",
  },
  {
    to: "/calculators/retirement" as const,
    icon: TrendingUp,
    title: "Rente vs capital",
    desc: "Compare rente LPP à vie ou retrait en capital + placement.",
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
