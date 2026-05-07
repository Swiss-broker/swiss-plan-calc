import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";

import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  Calculator,
  Coins,
  Wallet,
  PiggyBank,
  Landmark,
  Map,
  TrendingUp,
  HeartHandshake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const layoutSearchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators")({
  head: () => ({ meta: [{ title: "Calculateurs · SwissBroker Pro" }] }),
  validateSearch: zodValidator(layoutSearchSchema),
  component: CalculatorsLayout,
});

const TABS = [
  { to: "/calculators", label: "Vue d'ensemble", icon: Calculator, exact: true as boolean },
  { to: "/calculators/avs-ai", label: "1er pilier AVS/AI", icon: HeartHandshake, exact: false as boolean },
  { to: "/calculators/lpp", label: "2e pilier LPP & rachats", icon: Landmark, exact: false as boolean },
  { to: "/calculators/pillar3a", label: "3e pilier A & B", icon: PiggyBank, exact: false as boolean },
  { to: "/calculators/income-tax", label: "Impôt revenu & fortune", icon: Coins, exact: false as boolean },
  { to: "/calculators/source-tax", label: "Impôt à la source", icon: Wallet, exact: false as boolean },
  { to: "/calculators/canton-compare", label: "Comparateur cantonal", icon: Map, exact: false as boolean },
  { to: "/calculators/retirement", label: "Rente vs capital", icon: TrendingUp, exact: false as boolean },
] as const;

function CalculatorsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { clientId } = Route.useSearch();
  const tabSearch = clientId ? { clientId } : undefined;
  const currentTab =
    [...TABS].reverse().find((t) => (t.exact ? pathname === t.to : pathname.startsWith(t.to)))?.to ??
    "/calculators";
  const inClientContext = Boolean(clientId);
  return (
    <div
      className={cn(
        "min-h-[calc(100vh-3.5rem)] transition-colors",
        inClientContext &&
          "bg-primary/10 border-l-4 border-primary",
      )}
    >
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        {inClientContext && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            Mode dossier client
          </div>
        )}
        <h1 className="text-3xl font-bold tracking-tight">Calculateurs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Simulations rapides · barèmes 2026 · IFD, ICC, source, LPP, 3a, comparateur cantonal.
        </p>
      </div>

      {/* Mobile: select fallback for quick switching */}
      <div className="mb-4 sm:hidden">
        <Select value={currentTab} onValueChange={(v) => navigate({ to: v as (typeof TABS)[number]["to"], search: tabSearch })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TABS.map((t) => (
              <SelectItem key={t.to} value={t.to}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tablet+: horizontal scrollable tab bar */}
      <div className="-mx-4 mb-6 hidden overflow-x-auto px-4 sm:mx-0 sm:block sm:px-0">
        <nav className="flex min-w-max gap-1 rounded-xl border border-border bg-card/50 p-1">
          {TABS.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                search={tabSearch}
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
    </div>
  );
}
