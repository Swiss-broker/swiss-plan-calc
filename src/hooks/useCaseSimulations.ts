// Toutes les simulations sauvegardées du dossier actif (même client +
// même case_id), utilisées par le calculateur Budget pour mensualiser en
// direct les gains "annual" déjà identifiés ailleurs dans le même dossier
// (voir computeBudgetOptimizations dans @/lib/budget).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HistoryEntry } from "@/lib/history/types";

export function useCaseSimulations(clientId: string | undefined, caseId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ["case-simulations", clientId, caseId],
    enabled: Boolean(clientId),
    queryFn: async (): Promise<HistoryEntry[]> => {
      let query = supabase.from("simulation_history").select("*").eq("client_id", clientId!);
      query = caseId ? query.eq("case_id", caseId) : query.is("case_id", null);
      const { data, error } = await query;
      if (error || !data) return [];
      return data as unknown as HistoryEntry[];
    },
  });

  return { entries: data ?? [], isLoading };
}
