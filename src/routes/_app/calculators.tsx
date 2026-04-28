import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Calculator,
  Coins,
  Wallet,
  PiggyBank,
  Landmark,
  Map,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/calculators")({
  head: () => ({ meta: [{ title: "Calculateurs — SwissBroker Pro" }] }),
  component: CalculatorsLayout,
});

const TABS = [
  { to: "/calculators", label: "Vue d'ensemble", icon: Calculator, exact: true },
  { to: "/calculators/income-tax", label: "Impôt revenu & fortune", icon: Coins },
  { to: "/calculators/source-tax", label: "Impôt à la source", icon: Wallet },
  { to: "/calculators/lpp", label: "LPP & rachats", icon: Landmark },
  { to: "/calculators/pillar3a", label: "Pilier 3a", icon: PiggyBank },
  { to: "/calculators/canton-compare", label: "Comparateur cantonal", icon: Map },
  { to: "/calculators/retirement", label: "Rente vs capital", icon: TrendingUp },
] as const;

function CalculatorsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Calculateurs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Simulations rapides — barèmes 2026 — IFD, ICC, source, LPP, 3a, comparateur cantonal.
        </p>
      </div>
      <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <nav className="flex min-w-max gap-1 rounded-xl border border-border bg-card/50 p-1">
          {TABS.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-elegant"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
