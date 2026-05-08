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
import { useT } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/_app/calculators/")({
  head: () => ({ meta: [{ title: "Calculateurs · SwissBroker Pro" }] }),
  component: CalculatorsIndex,
});

const ITEMS = [
  { to: "/calculators/avs-ai" as const, icon: HeartHandshake, key: "avs_ai" },
  { to: "/calculators/lpp" as const, icon: Landmark, key: "lpp" },
  { to: "/calculators/pillar3a" as const, icon: PiggyBank, key: "pillar3a" },
  { to: "/calculators/vested-benefits" as const, icon: ShieldCheck, key: "vested" },
  { to: "/calculators/cross-border" as const, icon: Globe, key: "cross_border" },
  { to: "/calculators/income-tax" as const, icon: Coins, key: "income_tax" },
  { to: "/calculators/source-tax" as const, icon: Wallet, key: "source_tax" },
  { to: "/calculators/tou" as const, icon: Scale, key: "tou" },
  { to: "/calculators/retirement" as const, icon: TrendingUp, key: "retirement" },
  { to: "/calculators/director-compensation" as const, icon: Building2, key: "director" },
  { to: "/calculators/canton-compare" as const, icon: Map, key: "canton_compare" },
];

function CalculatorsIndex() {
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ITEMS.map((it) => (
        <Link key={it.to} to={it.to} className="group">
          <CalcCard className="h-full transition-all hover:border-primary/40 hover:shadow-elegant">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <it.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold tracking-tight">
              {t(`calc.${it.key}.title`)}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{t(`calc.${it.key}.desc`)}</p>
            <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary">
              {t("calc.open")} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </CalcCard>
        </Link>
      ))}
    </div>
  );
}
