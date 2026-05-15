import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Calculator,
  Coins,
  Landmark,
  PiggyBank,
  Scale,
  Globe2,
  Receipt,
  Sun,
  Vault,
  HeartHandshake,
  TrendingUp,
  LineChart,
  Info,
  ShieldPlus,
  Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Client } from "@/lib/clients/types";
import {
  getCalculatorRelevance,
  type CalcRoute,
} from "@/lib/clients/calculator-relevance";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { SimulationKind } from "@/lib/history/types";

type CalcChip = {
  to: CalcRoute;
  kind: SimulationKind;
  label: string;
  icon: LucideIcon;
};

const CHIPS: CalcChip[] = [
  { to: "/calculators/avs-ai", kind: "avs_ai", label: "1er pilier AVS/AI", icon: HeartHandshake },
  { to: "/calculators/lpp", kind: "lpp", label: "2e pilier LPP & rachats", icon: Landmark },
  { to: "/calculators/pillar3a", kind: "pillar3a", label: "3e pilier A & B", icon: PiggyBank },
  { to: "/calculators/vested-benefits", kind: "vested_benefits", label: "Libre passage", icon: Vault },
  { to: "/calculators/cross-border", kind: "cross_border", label: "Frontalier", icon: Globe2 },
  { to: "/calculators/health-insurance-france", kind: "health_insurance_france", label: "CNTFS / LAMal", icon: ShieldPlus },
  { to: "/calculators/overtime", kind: "overtime", label: "Heures supp", icon: Clock },
  { to: "/calculators/income-tax", kind: "income_tax", label: "Impôt revenu", icon: Receipt },
  { to: "/calculators/source-tax", kind: "source_tax", label: "Impôt à la source", icon: Coins },
  { to: "/calculators/retirement", kind: "retirement", label: "Rente vs capital", icon: Sun },
  { to: "/calculators/canton-compare", kind: "canton_compare", label: "Comparateur cantons", icon: Scale },
  { to: "/calculators/director-compensation", kind: "director_compensation", label: "Comparateur dirigeant", icon: TrendingUp },
  { to: "/calculators/investment-compare", kind: "investment_compare", label: "Comparateur d'investissements", icon: LineChart },
  { to: "/calculators/tou", kind: "tou", label: "TOU", icon: Calculator },
];

type LatestSimMap = Record<string, string>; // kind -> ISO created_at

function useLatestSimsByKind(clientId: string) {
  return useQuery<LatestSimMap>({
    queryKey: ["client-latest-sims", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulation_history")
        .select("kind, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map: LatestSimMap = {};
      for (const row of data ?? []) {
        if (!map[row.kind]) map[row.kind] = row.created_at;
      }
      return map;
    },
    staleTime: 30_000,
  });
}

export function ClientCalculatorBar({ client }: { client: Client }) {
  const { data: latestByKind } = useLatestSimsByKind(client.id);
  return (
    <TooltipProvider delayDuration={150}>
      <div className="rounded-lg border bg-card p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Calculator className="h-3.5 w-3.5" />
          Lancer un calcul pré-rempli
        </div>
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((chip) => (
            <ChipLink
              key={chip.to}
              chip={chip}
              client={client}
              lastSimAt={latestByKind?.[chip.kind] ?? null}
            />
          ))}
        </div>
        <p className="mt-2 text-[10.5px] text-muted-foreground">
          Les calculateurs grisés ne s'appliquent pas à ce profil. Une pastille orange signale une simulation à rafraîchir suite à une modification de la fiche.
        </p>
      </div>
    </TooltipProvider>
  );
}

function ChipLink({
  chip,
  client,
  lastSimAt,
}: {
  chip: CalcChip;
  client: Client;
  lastSimAt: string | null;
}) {
  const { relevant, reason } = getCalculatorRelevance(client, chip.to);
  const Icon = chip.icon;

  // Stale = simu existante antérieure à la dernière modification de la fiche client.
  const stale =
    lastSimAt != null &&
    client.updated_at != null &&
    new Date(client.updated_at).getTime() > new Date(lastSimAt).getTime();

  const search: Record<string, string> =
    chip.to === "/calculators/director-compensation" && client.company_id
      ? { clientId: client.id, companyId: client.company_id }
      : { clientId: client.id };

  const link = (
    <Link
      to={chip.to}
      search={search}
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition-colors",
        relevant
          ? "text-foreground hover:border-primary hover:bg-primary/5 hover:text-primary"
          : "border-dashed text-muted-foreground opacity-60 hover:opacity-90 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {chip.label}
      {!relevant && <Info className="h-3 w-3 opacity-70" />}
      {stale && (
        <span
          aria-label="Simulation à rafraîchir"
          className="ml-0.5 inline-block h-2 w-2 rounded-full bg-orange-500 ring-2 ring-background"
        />
      )}
    </Link>
  );

  if (relevant && !stale) return link;

  const tooltipText = !relevant
    ? reason
    : "La fiche client a été modifiée depuis la dernière simulation. Pensez à la relancer.";

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}
