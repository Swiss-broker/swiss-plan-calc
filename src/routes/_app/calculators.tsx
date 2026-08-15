import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";

import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  Calculator,
  Coins,
  
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
import { useT } from "@/contexts/LanguageContext";

const layoutSearchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators")({
  head: () => ({ meta: [{ title: "Calculateurs · SwissBroker Pro" }] }),
  validateSearch: zodValidator(layoutSearchSchema),
  component: CalculatorsLayout,
});

const TABS = [
  { to: "/calculators", labelKey: "calc.tab.overview", icon: Calculator, exact: true as boolean },
  { to: "/calculators/avs-ai", labelKey: "calc.tab.avs", icon: HeartHandshake, exact: false as boolean },
  { to: "/calculators/lpp", labelKey: "calc.tab.lpp", icon: Landmark, exact: false as boolean },
  { to: "/calculators/pillar3a", labelKey: "calc.tab.pillar3a", icon: PiggyBank, exact: false as boolean },
  { to: "/calculators/tax-global", labelKey: "calc.global.title", icon: Coins, exact: false as boolean },
  { to: "/calculators/canton-compare", labelKey: "calc.tab.canton_compare", icon: Map, exact: false as boolean },
  { to: "/calculators/retirement", labelKey: "calc.tab.retirement", icon: TrendingUp, exact: false as boolean },
] as const;

const MORE_TABS = [
  { to: "/calculators/vested-benefits", labelKey: "calc.tab.vested_benefits", icon: Landmark, exact: false as boolean },
  { to: "/calculators/director-compensation", labelKey: "calc.tab.director", icon: TrendingUp, exact: false as boolean },
  { to: "/calculators/health-insurance-france", labelKey: "calc.tab.health_fr", icon: Coins, exact: false as boolean },
  { to: "/calculators/overtime", labelKey: "calc.tab.overtime", icon: Coins, exact: false as boolean },
  { to: "/calculators/investment-compare", labelKey: "calc.tab.investment_compare", icon: TrendingUp, exact: false as boolean },
  { to: "/calculators/fx-claim", labelKey: "calc.tab.fx_claim", icon: Coins, exact: false as boolean },
] as const;

const ALL_TABS = [...TABS, ...MORE_TABS] as const;

function CalculatorsLayout() {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { clientId } = Route.useSearch();
  const tabSearch = clientId ? { clientId } : undefined;
  const currentTab =
    [...ALL_TABS].reverse().find((tab) => (tab.exact ? pathname === tab.to : pathname.startsWith(tab.to)))?.to ??
    "/calculators";
  const isMoreActive = MORE_TABS.some((tab) => pathname.startsWith(tab.to));
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
            {t("calc.client_mode")}
          </div>
        )}
        <h1 className="text-3xl font-bold tracking-tight">{t("nav.calculators")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("calc.subtitle")}</p>
      </div>

      {/* Mobile: select fallback for quick switching */}
      <div className="mb-4 sm:hidden">
        <Select value={currentTab} onValueChange={(v) => navigate({ to: v as (typeof ALL_TABS)[number]["to"], search: tabSearch })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_TABS.map((tab) => (
              <SelectItem key={tab.to} value={tab.to}>
                {t(tab.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tablet+: wrapping tab bar (jamais d'élément caché hors champ) */}
      <div className="mb-6 hidden sm:block">
        <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card/50 p-1">
          {TABS.map((tab) => {
            const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                search={tabSearch}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-elegant"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <tab.icon className="h-4 w-4" />
                {t(tab.labelKey)}
              </Link>
            );
          })}
          <Select
            value={isMoreActive ? currentTab : ""}
            onValueChange={(v) => navigate({ to: v as (typeof MORE_TABS)[number]["to"], search: tabSearch })}
          >
            <SelectTrigger
              className={cn(
                "h-auto w-auto gap-1.5 whitespace-nowrap rounded-lg border-0 px-3 py-2 text-sm font-medium",
                isMoreActive
                  ? "bg-primary text-primary-foreground shadow-elegant"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span>{t("calc.tab.more")}</span>
            </SelectTrigger>
            <SelectContent>
              {MORE_TABS.map((tab) => (
                <SelectItem key={tab.to} value={tab.to}>
                  <span className="flex items-center gap-2">
                    <tab.icon className="h-4 w-4" />
                    {t(tab.labelKey)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </nav>
      </div>
      <Outlet />
    </div>
    </div>
  );
}
