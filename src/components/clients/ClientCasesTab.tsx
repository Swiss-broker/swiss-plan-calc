// Onglet "Dossiers" de la fiche client : vue complète des dossiers
// (ouverts/terminés) + le dossier virtuel "Historique" qui regroupe les
// simulations enregistrées avant cette fonctionnalité (case_id NULL) —
// jamais une vraie ligne en base, calculé ici à l'affichage pour ne rien
// perdre sans réécrire en masse les anciennes simulations.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Clock, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useClientCases,
  useCreateClientCase,
  useSetClientCaseStatus,
  type ClientCase,
} from "@/hooks/useClientCases";

function useSimCountsByCase(clientId: string) {
  return useQuery({
    queryKey: ["client-sim-counts-by-case", clientId],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("simulation_history")
        .select("case_id")
        .eq("client_id", clientId);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const key = row.case_id ?? "__none__";
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return counts;
    },
  });
}

export function ClientCasesTab({
  clientId,
  activeCaseId,
  onSelectCase,
  onCreateCase,
}: {
  clientId: string;
  activeCaseId: string | undefined;
  onSelectCase: (caseId: string | undefined) => void;
  /** Appelé UNIQUEMENT quand un NOUVEAU dossier vient d'être créé depuis cet
   *  onglet (jamais pour l'ouverture d'un dossier existant via "Ouvrir") —
   *  même rôle que onCreateCase sur ClientCalculatorBar : rediriger vers le
   *  calculateur Budget pour que le budget soit toujours établi en premier,
   *  quel que soit l'endroit de la fiche depuis lequel le dossier a été
   *  créé. Si absent, retombe sur le comportement onSelectCase habituel. */
  onCreateCase?: (caseId: string) => void;
}) {
  const { cases, isLoading } = useClientCases(clientId);
  const { data: counts } = useSimCountsByCase(clientId);
  const createCase = useCreateClientCase(clientId);
  const setStatus = useSetClientCaseStatus(clientId);

  const [showNewCaseForm, setShowNewCaseForm] = useState(false);
  const [newCaseName, setNewCaseName] = useState("");

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

  const historyCount = counts?.["__none__"] ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-lg text-xs text-muted-foreground">
          Chaque dossier regroupe les simulations faites pour un même projet de ce client. Depuis la
          fiche client, un dossier doit être actif pour utiliser les calculateurs — tout ce qui est
          enregistré pendant qu'il est actif y est automatiquement rattaché.
        </p>
        <Button size="sm" className="shrink-0 gap-1.5" onClick={() => setShowNewCaseForm(true)}>
          <Plus className="h-3.5 w-3.5" />
          Nouveau dossier
        </Button>
      </div>

      {showNewCaseForm && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <Input
            autoFocus
            placeholder="Nom du dossier, ex. « Rachat LPP 2027 »"
            value={newCaseName}
            onChange={(e) => setNewCaseName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNewCase()}
            className="h-9 flex-1 text-sm"
          />
          <Button size="sm" onClick={submitNewCase} disabled={createCase.isPending}>
            Créer
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

      {isLoading && <div className="text-sm text-muted-foreground">Chargement…</div>}

      <div className="space-y-2">
        {cases.map((c) => (
          <CaseRow
            key={c.id}
            clientCase={c}
            count={counts?.[c.id] ?? 0}
            active={c.id === activeCaseId}
            onOpen={() => onSelectCase(c.id)}
            onToggleStatus={() =>
              setStatus.mutate({ caseId: c.id, status: c.status === "open" ? "closed" : "open" })
            }
          />
        ))}

        {/* Dossier virtuel "Historique" — simulations sans case_id */}
        {historyCount > 0 && (
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Clock className="h-4 w-4" />
            </div>
            <div className="min-w-[200px] flex-1">
              <div className="mb-0.5 flex items-center gap-2">
                <span className="font-semibold text-foreground/80">
                  Historique (avant dossiers)
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  Automatique
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Simulations enregistrées avant l'introduction des dossiers — regroupées ici, rien
                n'est perdu.
              </div>
            </div>
            <div className="shrink-0 text-sm font-semibold text-muted-foreground">
              {historyCount} simulation{historyCount > 1 ? "s" : ""}
            </div>
          </div>
        )}

        {!isLoading && cases.length === 0 && historyCount === 0 && (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aucun dossier pour ce client. Créez-en un pour commencer une simulation.
          </div>
        )}
      </div>
    </div>
  );
}

function CaseRow({
  clientCase,
  count,
  active,
  onOpen,
  onToggleStatus,
}: {
  clientCase: ClientCase;
  count: number;
  active: boolean;
  onOpen: () => void;
  onToggleStatus: () => void;
}) {
  const open = clientCase.status === "open";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-xl border p-4",
        active ? "border-primary/40 bg-primary/5" : "border-border bg-card",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
          open ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
        )}
      >
        <FolderOpen className="h-4 w-4" />
      </div>
      <div className="min-w-[200px] flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="font-semibold">{clientCase.title}</span>
          <Badge
            variant="secondary"
            className={cn(
              "gap-1 text-[10px]",
              open ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                open ? "bg-success" : "bg-muted-foreground",
              )}
            />
            {open ? "Ouvert" : "Terminé"}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          Créé le {new Date(clientCase.created_at).toLocaleDateString("fr-CH")}
          {clientCase.closed_at &&
            ` · Terminé le ${new Date(clientCase.closed_at).toLocaleDateString("fr-CH")}`}
        </div>
      </div>
      <div className="shrink-0 text-sm font-semibold text-muted-foreground">
        {count} simulation{count > 1 ? "s" : ""}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" onClick={onOpen}>
          Ouvrir
        </Button>
        <Button size="sm" variant="outline" onClick={onToggleStatus}>
          {open ? "Terminer" : "Réouvrir"}
        </Button>
      </div>
    </div>
  );
}
