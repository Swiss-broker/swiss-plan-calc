// Bandeau de reprise de simulation : quand une simulation plus récente
// existe sur un autre calculateur (LPP, 3e pilier) pour ce client et
// diffère du profil de base, propose explicitement au courtier de la
// reprendre dans le calcul courant — au lieu de la laisser invisible
// (voir useConsolidationReferences, déjà utilisé silencieusement par le
// comparateur cantonal et la carte "Prestations consolidées", mais jamais
// comme un choix explicite avant ce composant).
import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCHF } from "@/lib/format";
import { useConsolidationReferences } from "@/hooks/useConsolidationReferences";

export interface ReuseProvenance {
  field: "lppBuyback" | "pillar3aContributions";
  label: string;
  value: number;
  date: string;
  simTitle?: string;
}

interface Candidate {
  key: string;
  field: ReuseProvenance["field"];
  label: string;
  value: number;
  date: string;
  simTitle?: string;
}

interface Props {
  clientId: string | undefined;
  caseId: string | undefined;
  currentLppBuyback: number;
  currentPillar3aContributions: number;
  onApply: (provenance: ReuseProvenance) => void;
}

export function CrossSimulationReuseBanner({
  clientId,
  caseId,
  currentLppBuyback,
  currentPillar3aContributions,
  onApply,
}: Props) {
  const { data: refs } = useConsolidationReferences(clientId, caseId);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (!clientId) return null;

  const candidates: Candidate[] = [];

  const lppEntry = refs?.lpp;
  if (lppEntry) {
    const lppInputs = lppEntry.inputs as Record<string, unknown> | undefined;
    const simulated = Number(lppInputs?.actualBuyback ?? 0);
    if (simulated > 0 && simulated !== currentLppBuyback) {
      candidates.push({
        key: `lpp:${lppEntry.id}`,
        field: "lppBuyback",
        label: "Rachat LPP",
        value: simulated,
        date: lppEntry.created_at,
        simTitle: lppEntry.title,
      });
    }
  }

  const p3aEntry = refs?.pillar3a;
  if (p3aEntry) {
    const p3aInputs = p3aEntry.inputs as Record<string, unknown> | undefined;
    const simulated = Number(p3aInputs?.contribution ?? 0);
    if (simulated > 0 && simulated !== currentPillar3aContributions) {
      candidates.push({
        key: `pillar3a:${p3aEntry.id}`,
        field: "pillar3aContributions",
        label: "Cotisation 3e pilier A",
        value: simulated,
        date: p3aEntry.created_at,
        simTitle: p3aEntry.title,
      });
    }
  }

  const visible = candidates.filter((c) => !dismissed.has(c.key));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((c) => (
        <div
          key={c.key}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm"
        >
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <div>
              <strong className="text-foreground">Simulation plus récente trouvée.</strong>{" "}
              <span className="text-muted-foreground">
                {c.label} de {formatCHF(c.value)}
                {c.simTitle ? ` (« ${c.simTitle} »)` : ""} enregistré le{" "}
                {new Date(c.date).toLocaleDateString("fr-CH")}, différent du profil de base du
                client. L'utiliser pour ce calcul ?
              </span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onApply({
                  field: c.field,
                  label: c.label,
                  value: c.value,
                  date: c.date,
                  simTitle: c.simTitle,
                });
                setDismissed((d) => new Set(d).add(c.key));
              }}
            >
              Utiliser cette simulation
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setDismissed((d) => new Set(d).add(c.key))}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Garder le profil de base
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
