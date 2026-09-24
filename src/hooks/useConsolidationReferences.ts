// Simulations de référence (AVS/AI, LPP, 3a) utilisées comme source des
// chiffres "actuels" de la carte « Prestations consolidées » et du
// calculateur dédié — même sélection (pickLatestNonDismissed) que celle
// déjà utilisée dans le PDF de synthèse (Résumé par catégorie, Comparatif
// avant/après), pour que la fiche client et le PDF affichent toujours les
// mêmes chiffres.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HistoryEntry } from "@/lib/history/types";
import { pickConsolidationReferences, type ConsolidationReferenceSimulations } from "@/lib/pension-consolidation";

export function useConsolidationReferences(clientId: string | undefined) {
  return useQuery({
    queryKey: ["consolidation-references", clientId],
    enabled: Boolean(clientId),
    queryFn: async (): Promise<ConsolidationReferenceSimulations> => {
      if (!clientId) return {};
      const { data, error } = await supabase
        .from("simulation_history")
        .select("*")
        .eq("client_id", clientId)
        .in("kind", ["avs_ai", "lpp", "pillar3a"]);
      if (error || !data) return {};
      return pickConsolidationReferences(data as unknown as HistoryEntry[]);
    },
  });
}
