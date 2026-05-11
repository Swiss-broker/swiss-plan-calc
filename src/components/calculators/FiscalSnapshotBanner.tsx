import { Activity } from "lucide-react";
import { useClientFiscalSnapshot } from "@/hooks/useClientFiscalSnapshot";

/**
 * Affiche, lorsqu'une fiche client est ouverte, un bandeau résumant
 * la dernière simulation fiscale enregistrée (taux moyen + marginal estimé).
 * Permet aux calculateurs 3a / LPP / retraite d'afficher la cohérence
 * avec la dernière simulation impôt revenu/source.
 */
export function FiscalSnapshotBanner({ clientId }: { clientId?: string }) {
  const { data: snapshot } = useClientFiscalSnapshot(clientId);
  if (!snapshot) return null;
  const date = new Date(snapshot.lastUpdated).toLocaleDateString("fr-CH");
  const sourceLabel =
    snapshot.source === "income_tax" ? "impôt revenu & fortune" : "impôt à la source";
  return (
    <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
      <Activity className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="flex-1">
        <div className="font-medium">
          Dernière simulation fiscale ({sourceLabel}) — {date}
        </div>
        <div className="mt-0.5 text-muted-foreground">
          Taux moyen <strong>{snapshot.averageRate.toFixed(1)} %</strong> ·
          marginal estimé <strong>{snapshot.marginalRateEstimate.toFixed(1)} %</strong>.
          Ces valeurs servent de référence pour les optimisations 3a / LPP / retraite.
        </div>
      </div>
    </div>
  );
}
