// Hook qui recharge une simulation sauvegardée précise (par son id) depuis
// simulation_history, pour permettre de rouvrir un brouillon exactement
// comme il a été laissé, plutôt que de repartir d'un formulaire vierge.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HistoryEntry } from "@/lib/history/types";

export function useLoadSavedSimulation(simId: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["saved-simulation", simId],
    enabled: Boolean(simId),
    queryFn: async (): Promise<HistoryEntry> => {
      const { data, error } = await supabase
        .from("simulation_history")
        .select("*")
        .eq("id", simId!)
        .single();
      if (error) throw error;
      return data as unknown as HistoryEntry;
    },
  });

  return {
    entry: data ?? null,
    // inputs = les valeurs exactes du formulaire au moment de la sauvegarde
    inputs: (data?.inputs as Record<string, unknown> | undefined) ?? null,
    isLoading,
    error: (error as Error | null) ?? null,
  };
}