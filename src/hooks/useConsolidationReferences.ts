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

// Filtré par dossier (case_id) : une simulation enregistrée dans un dossier
// ne doit jamais servir de référence "actuelle" dans un AUTRE dossier du
// même client (capital LPP, rachats, etc. d'un scénario différent). Sans
// caseId, on se limite au dossier virtuel "historique" (case_id NULL),
// jamais à tout le client — pas de fuite entre dossiers.
export function useConsolidationReferences(
  clientId: string | undefined,
  caseId: string | undefined,
) {
  return useQuery({
    queryKey: ["consolidation-references", clientId, caseId],
    enabled: Boolean(clientId),
    queryFn: async (): Promise<ConsolidationReferenceSimulations> => {
      if (!clientId) return {};
      let query = supabase
        .from("simulation_history")
        .select("*")
        .eq("client_id", clientId)
        .in("kind", ["avs_ai", "lpp", "pillar3a", "tax_global"]);
      query = caseId ? query.eq("case_id", caseId) : query.is("case_id", null);
      const { data, error } = await query;
      if (error || !data) return {};
      return pickConsolidationReferences(data as unknown as HistoryEntry[]);
    },
  });
}
