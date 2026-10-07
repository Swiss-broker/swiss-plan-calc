import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Calculator,
  Landmark,
  PiggyBank,
  Scale,
  Sun,
  Vault,
  HeartHandshake,
  TrendingUp,
  LineChart,
  Info,
  ShieldPlus,
  Clock,
  Receipt,
  Layers,
  FolderOpen,
  Lock,
  Plus,
  ChevronDown,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Client } from "@/lib/clients/types";
import { getCalculatorRelevance, type CalcRoute } from "@/lib/clients/calculator-relevance";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { SimulationKind } from "@/lib/history/types";
import {
  useClientCases,
  useCreateClientCase,
  useSetClientCaseStatus,
} from "@/hooks/useClientCases";

type CalcChip = {
  to: CalcRoute;
  // Absent pour les calculateurs qui ne sauvegardent pas leur propre
  // simulation (ex. Prestations consolidées, qui lit celles des autres) —
  // pas de pastille « à rafraîchir » possible dans ce cas.
  kind?: SimulationKind;
  label: string;
  icon: LucideIcon;
};

const CHIPS: CalcChip[] = [
  { to: "/calculators/budget", kind: "budget", label: "Budget", icon: Wallet },
  { to: "/calculators/tax-global", kind: "income_tax", label: "Fiscalité globale", icon: Receipt },
  { to: "/calculators/avs-ai", kind: "avs_ai", label: "1er pilier AVS/AI", icon: HeartHandshake },
  { to: "/calculators/lpp", kind: "lpp", label: "2e pilier LPP & rachats", icon: Landmark },
  { to: "/calculators/pillar3a", kind: "pillar3a", label: "3e pilier A & B", icon: PiggyBank },
  {
    to: "/calculators/vested-benefits",
    kind: "vested_benefits",
    label: "Libre passage",
    icon: Vault,
  },
  {
    to: "/calculators/consolidated-benefits",
    label: "Prestations consolidées",
    icon: Layers,
  },
  {
    to: "/calculators/health-insurance-france",
    kind: "health_insurance_france",
    label: "CMU / LAMal",
    icon: ShieldPlus,
  },
  { to: "/calculators/overtime", kind: "overtime", label: "Heures supp", icon: Clock },
  { to: "/calculators/retirement", kind: "retirement", label: "Rente vs capital", icon: Sun },
  {
    to: "/calculators/canton-compare",
    kind: "canton_compare",
    label: "Comparateur cantons",
    icon: Scale,
  },
  {
    to: "/calculators/director-compensation",
    kind: "director_compensation",
    label: "Comparateur dirigeant",
    icon: TrendingUp,
  },
  {
    to: "/calculators/investment-compare",
    kind: "investment_compare",
    label: "Comparateur d'investissements",
    icon: LineChart,
  },
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

export function ClientCalculatorBar({
  client,
  activeCaseId,
  onSelectCase,
  onCreateCase,
}: {
  client: Client;
  /** Dossier actif (depuis l'URL, ?caseId=...) — tant qu'aucun n'est actif,
   *  les calculateurs restent verrouillés : c'est le dossier qui regroupe
   *  les simulations faites pour un même projet, au lieu de tout empiler à
   *  plat pour ce client. */
  activeCaseId: string | undefined;
  onSelectCase: (caseId: string | undefined) => void;
  /** Appelé UNIQUEMENT quand un NOUVEAU dossier vient d'être créé (jamais
   *  pour la sélection d'un dossier existant) — permet de rediriger
   *  directement vers le calculateur Budget, pour que le budget soit
   *  toujours établi en premier dans un dossier fraîchement créé. Si
   *  absent, retombe sur le comportement onSelectCase habituel. */
  onCreateCase?: (caseId: string) => void;
}) {
  const { data: latestByKind } = useLatestSimsByKind(client.id);
  const { cases } = useClientCases(client.id);
  const createCase = useCreateClientCase(client.id);
  const setStatus = useSetClientCaseStatus(client.id);

  const [showNewCaseForm, setShowNewCaseForm] = useState(false);
  const [newCaseName, setNewCaseName] = useState("");

  const activeCase = cases.find((c) => c.id === activeCaseId);
  // Un dossier terminé ne doit PLUS donner accès aux calculateurs : avant ce
  // correctif, fermer un dossier le laissait quand même actif/déverrouillé
  // (locked ne regardait que "y a-t-il un dossier", jamais son statut).
  const closed = activeCase?.status === "closed";
  const locked = !activeCase || closed;

  const submitNewCase = () => {
    const title = newCaseName.trim();
    if (!title) return;
    createCase.mutate(title, {
      onSuccess: (created) => {
        if (onCreateCase) onCreateCase(created.id);
        else onSelectCase(created.id);
        setShowNewCaseForm(false);
        setNewCaseName("");
      },
    });
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="rounded-lg border bg-card p-3">
        {/* ── Dossier actif ── */}
        <div
          className={cn(
            "mb-3 rounded-md border p-3",
            activeCase ? "border-success/40 bg-success/5" : "border-border bg-muted/30",
          )}
        >
          {!activeCase ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FolderOpen className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Aucun dossier actif</div>
                  <div className="text-xs text-muted-foreground">
                    Créez ou sélectionnez un dossier pour activer les calculateurs sur cette fiche.
                  </div>
                </div>
              </div>
              <Button size="sm" className="gap-1.5" onClick={() => setShowNewCaseForm(true)}>
                <Plus className="h-3.5 w-3.5" />
                Nouveau dossier
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-success">
                  Dossier actif
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-success/40 bg-background font-semibold"
                    >
                      <span className="inline-block h-2 w-2 rounded-full bg-success" />
                      {activeCase.title}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {cases.map((c) => (
                      <DropdownMenuItem
                        key={c.id}
                        onSelect={() => onSelectCase(c.id)}
                        className="gap-2"
                      >
                        <span
                          className={cn(
                            "inline-block h-1.5 w-1.5 rounded-full",
                            c.status === "open" ? "bg-success" : "bg-muted-foreground",
                          )}
                        />
                        <span className="flex-1 truncate">{c.title}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {c.status === "open" ? "Ouvert" : "Terminé"}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setShowNewCaseForm(true)}
                      className="gap-2 text-primary"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nouveau dossier
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setStatus.mutate({
                    caseId: activeCase.id,
                    status: activeCase.status === "open" ? "closed" : "open",
                  })
                }
              >
                {activeCase.status === "open" ? "Terminer ce dossier" : "Réouvrir ce dossier"}
              </Button>
            </div>
          )}

          {showNewCaseForm && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
              <Input
                autoFocus
                placeholder="Nom du dossier, ex. « Projection retraite 2026 »"
                value={newCaseName}
                onChange={(e) => setNewCaseName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitNewCase()}
                className="h-9 flex-1 text-sm"
              />
              <Button size="sm" onClick={submitNewCase} disabled={createCase.isPending}>
                Créer et activer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowNewCaseForm(false);
                  setNewCaseName("");
                }}
              >
                Annuler
              </Button>
            </div>
          )}
        </div>

        {/* ── Calculateurs ── */}
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
              lastSimAt={chip.kind ? (latestByKind?.[chip.kind] ?? null) : null}
              locked={locked}
              closed={closed}
              caseId={activeCase?.id}
              onLockedClick={() => {
                if (!closed) setShowNewCaseForm(true);
              }}
            />
          ))}
        </div>
        <p className="mt-2 text-[10.5px] text-muted-foreground">
          {closed
            ? "Ce dossier est terminé. Réouvrez-le ci-dessus pour relancer des calculateurs."
            : locked
              ? "Créez ou sélectionnez un dossier ci-dessus pour activer les calculateurs."
              : "Les calculateurs grisés ne s'appliquent pas à ce profil. Une pastille orange signale une simulation à rafraîchir suite à une modification de la fiche."}
        </p>
      </div>
    </TooltipProvider>
  );
}

function ChipLink({
  chip,
  client,
  lastSimAt,
  locked,
  closed,
  caseId,
  onLockedClick,
}: {
  chip: CalcChip;
  client: Client;
  lastSimAt: string | null;
  locked: boolean;
  closed: boolean;
  caseId: string | undefined;
  onLockedClick: () => void;
}) {
  const { relevant, reason } = getCalculatorRelevance(client, chip.to);
  const Icon = chip.icon;

  // Stale = simu existante antérieure à la dernière modification de la fiche client.
  const stale =
    lastSimAt != null &&
    client.updated_at != null &&
    new Date(client.updated_at).getTime() > new Date(lastSimAt).getTime();

  if (locked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onLockedClick}
            className="relative inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-dashed bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground opacity-60"
          >
            <Icon className="h-3.5 w-3.5" />
            {chip.label}
            <Lock className="h-3 w-3 opacity-70" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          {closed
            ? "Ce dossier est terminé. Réouvrez-le pour relancer ce calculateur."
            : "Créez ou sélectionnez un dossier pour activer ce calculateur."}
        </TooltipContent>
      </Tooltip>
    );
  }

  const search: Record<string, string> = {
    clientId: client.id,
    ...(caseId ? { caseId } : {}),
    ...(chip.to === "/calculators/director-compensation" && client.company_id
      ? { companyId: client.company_id }
      : {}),
  };

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
