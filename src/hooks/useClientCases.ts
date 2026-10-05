// Dossiers client (client_cases) : regroupent les simulations faites pour un
// même projet, pour que la synthèse PDF ne mélange plus toutes les
// simulations jamais faites pour un client. Voir la migration
// 20261005155136_create_client_cases.sql et HistoryEntry.case_id.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ClientCase {
  id: string;
  broker_id: string;
  client_id: string;
  title: string;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export function useClientCases(clientId: string | undefined) {
  const query = useQuery({
    queryKey: ["client-cases", clientId],
    enabled: Boolean(clientId),
    queryFn: async (): Promise<ClientCase[]> => {
      const { data, error } = await supabase
        .from("client_cases")
        .select("*")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientCase[];
    },
  });

  return {
    cases: query.data ?? [],
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}

export function useCreateClientCase(clientId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title: string): Promise<ClientCase> => {
      if (!user) throw new Error("Non authentifié");
      if (!clientId) throw new Error("Client manquant");
      const { data, error } = await supabase
        .from("client_cases")
        .insert({ broker_id: user.id, client_id: clientId, title: title.trim(), status: "open" })
        .select("*")
        .single();
      if (error) throw error;
      return data as ClientCase;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-cases", clientId] });
    },
  });
}

export function useSetClientCaseStatus(clientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { caseId: string; status: "open" | "closed" }) => {
      const { error } = await supabase
        .from("client_cases")
        .update({
          status: vars.status,
          closed_at: vars.status === "closed" ? new Date().toISOString() : null,
        })
        .eq("id", vars.caseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-cases", clientId] });
    },
  });
}
