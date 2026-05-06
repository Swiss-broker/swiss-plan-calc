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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Client } from "@/lib/clients/types";
import { getWorkStatusRules } from "@/lib/clients/work-status-rules";

type CalcRoute =
  | "/calculators/income-tax"
  | "/calculators/source-tax"
  | "/calculators/cross-border"
  | "/calculators/pillar3a"
  | "/calculators/lpp"
  | "/calculators/vested-benefits"
  | "/calculators/retirement"
  | "/calculators/canton-compare"
  | "/calculators/avs-ai"
  | "/calculators/tou";

type CalcChip = {
  to: CalcRoute;
  label: string;
  icon: LucideIcon;
  show?: (c: Client) => boolean;
};

const CHIPS: CalcChip[] = [
  { to: "/calculators/income-tax", label: "Impôt revenu", icon: Receipt },
  {
    to: "/calculators/source-tax",
    label: "Impôt à la source",
    icon: Coins,
    show: (c) => c.tax_status === "source_taxed" || c.tax_status === "quasi_resident",
  },
  {
    to: "/calculators/cross-border",
    label: "Frontalier",
    icon: Globe2,
    show: (c) => c.tax_status === "cross_border_g",
  },
  { to: "/calculators/pillar3a", label: "3ᵉ pilier A", icon: PiggyBank },
  { to: "/calculators/lpp", label: "Rachat LPP", icon: Landmark },
  { to: "/calculators/vested-benefits", label: "Libre passage", icon: Vault },
  { to: "/calculators/retirement", label: "Retraite", icon: Sun },
  { to: "/calculators/canton-compare", label: "Comparateur cantons", icon: Scale },
  { to: "/calculators/avs-ai", label: "Rente AVS/AI", icon: HeartHandshake },
  { to: "/calculators/tou", label: "TOU", icon: Calculator },
];

export function ClientCalculatorBar({ client }: { client: Client }) {
  const workRules = getWorkStatusRules(client.work_status);
  const visible = CHIPS.filter(
    (c) => (!c.show || c.show(client)) && !workRules.hiddenCalculators.has(c.to),
  );
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Calculator className="h-3.5 w-3.5" />
        Lancer un calcul pré-rempli
      </div>
      <div className="flex flex-wrap gap-2">
        {visible.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            search={{ clientId: client.id }}
            className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
