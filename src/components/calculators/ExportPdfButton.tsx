// src/components/calculators/ExportPdfButton.tsx
// Bouton d'export PDF pour un calculateur individuel, avec le même verrou
// que la Synthèse RDV (SessionSummaryTab.tsx) : un rapport ne peut être
// téléchargé que si le client rattaché a une facture RDV payée et non
// reverrouillée (rdv_invoices.pdf_unlocked=true). Sans clientId (mode
// autonome, aucun client rattaché), l'export reste verrouillé par défaut :
// il n'y a rien à "avoir payé" dans ce cas, et laisser passer recréerait
// exactement la faille qu'on referme (il suffirait de ne jamais choisir de
// client pour exporter librement). fx-claim.tsx n'utilise pas ce
// composant, volontairement : son "courrier PDF" reste libre d'accès.
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function usePdfUnlocked(clientId: string | undefined) {
  const { data: unlocked = false, isLoading } = useQuery({
    queryKey: ["pdf-unlocked", clientId],
    enabled: !!clientId,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await supabase
        .from("rdv_invoices")
        .select("pdf_unlocked")
        .eq("client_id", clientId as string)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(1);
      if (!data || data.length === 0) return false;
      return data[0].pdf_unlocked;
    },
  });
  return { pdfUnlocked: unlocked, pdfUnlockLoading: isLoading };
}

export function ExportPdfButton({
  clientId,
  onExport,
  label,
}: {
  clientId: string | undefined;
  onExport: () => void;
  label?: string;
}) {
  const navigate = useNavigate();
  const { pdfUnlocked, pdfUnlockLoading } = usePdfUnlocked(clientId);
  const text = label ?? "Télécharger le rapport PDF";

  if (pdfUnlockLoading) {
    return (
      <Button type="button" variant="outline" className="gap-2" disabled>
        <Download className="h-4 w-4" />
        {text}
      </Button>
    );
  }

  if (!pdfUnlocked) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="outline"
          className="gap-2 text-muted-foreground"
          disabled={!clientId}
          onClick={() => {
            if (!clientId) return;
            navigate({ to: "/clients/$clientId", params: { clientId }, search: { tab: "session" } });
          }}
        >
          <Lock className="h-4 w-4" />
          {text}
        </Button>
        <span className="max-w-[220px] text-right text-[11px] text-muted-foreground">
          {clientId
            ? "Facturez d'abord ce rendez-vous (Synthèse RDV) pour débloquer l'export."
            : "Rattachez ce calcul à une fiche client, puis facturez le rendez-vous, pour débloquer l'export."}
        </span>
      </div>
    );
  }

  return (
    <Button type="button" variant="outline" className="gap-2" onClick={onExport}>
      <Download className="h-4 w-4" />
      {text}
    </Button>
  );
}
