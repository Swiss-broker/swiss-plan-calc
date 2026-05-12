import { Link } from "@tanstack/react-router";
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
  Info,
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

type CalcChip = {
  to: CalcRoute;
  label: string;
  icon: LucideIcon;
};

const CHIPS: CalcChip[] = [
  { to: "/calculators/avs-ai", label: "1er pilier AVS/AI", icon: HeartHandshake },
  { to: "/calculators/lpp", label: "2e pilier LPP & rachats", icon: Landmark },
  { to: "/calculators/pillar3a", label: "3e pilier A & B", icon: PiggyBank },
  { to: "/calculators/vested-benefits", label: "Libre passage", icon: Vault },
  { to: "/calculators/cross-border", label: "Frontalier", icon: Globe2 },
  { to: "/calculators/income-tax", label: "Impôt revenu", icon: Receipt },
  { to: "/calculators/source-tax", label: "Impôt à la source", icon: Coins },
  { to: "/calculators/retirement", label: "Rente vs capital", icon: Sun },
  { to: "/calculators/canton-compare", label: "Comparateur cantons", icon: Scale },
  { to: "/calculators/director-compensation", label: "Comparateur dirigeant", icon: TrendingUp },
  { to: "/calculators/tou", label: "TOU", icon: Calculator },
];

export function ClientCalculatorBar({ client }: { client: Client }) {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="rounded-lg border bg-card p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Calculator className="h-3.5 w-3.5" />
          Lancer un calcul pré-rempli
        </div>
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((chip) => (
            <ChipLink key={chip.to} chip={chip} client={client} />
          ))}
        </div>
        <p className="mt-2 text-[10.5px] text-muted-foreground">
          Les calculateurs grisés ne s'appliquent pas à ce profil · clic possible pour une simulation what-if.
        </p>
      </div>
    </TooltipProvider>
  );
}

function ChipLink({ chip, client }: { chip: CalcChip; client: Client }) {
  const { relevant, reason } = getCalculatorRelevance(client, chip.to);
  const Icon = chip.icon;

  // Director-compensation requires both clientId + companyId for prefill ;
  // si pas de société, on bascule en lien vers la page autonome (clientId seulement).
  const search: Record<string, string> =
    chip.to === "/calculators/director-compensation" && client.company_id
      ? { clientId: client.id, companyId: client.company_id }
      : { clientId: client.id };

  const link = (
    <Link
      to={chip.to}
      search={search}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition-colors",
        relevant
          ? "text-foreground hover:border-primary hover:bg-primary/5 hover:text-primary"
          : "border-dashed text-muted-foreground opacity-60 hover:opacity-90 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {chip.label}
      {!relevant && <Info className="h-3 w-3 opacity-70" />}
    </Link>
  );

  if (relevant) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}
