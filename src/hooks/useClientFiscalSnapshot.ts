// Récupère la dernière simulation fiscale enregistrée pour un client et
// expose un taux moyen / taux marginal estimés. income_tax et source_tax
// sont d'anciens calculateurs, remplacés par tax_global (qui gère tous les
// régimes fiscaux) — leurs routes redirigent maintenant vers tax_global et
// plus aucune sauvegarde n'y arrive, donc tax_global doit rester dans cette
// liste pour que ce snapshot continue à trouver quelque chose.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientFiscalSnapshot {
  averageRate: number;
  marginalRateEstimate: number;
  source: "income_tax" | "source_tax" | "tax_global";
  lastUpdated: string;
}

export function useClientFiscalSnapshot(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client-fiscal-snapshot", clientId],
    enabled: Boolean(clientId),
    queryFn: async (): Promise<ClientFiscalSnapshot | null> => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("simulation_history")
        .select("kind, summary, created_at")
        .eq("client_id", clientId)
        .in("kind", ["income_tax", "source_tax", "tax_global"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      const s = (data.summary ?? {}) as Record<string, unknown>;
      // income_tax et tax_global stockent effectiveRate/marginalRate ;
      // source_tax stocke rate.
      const avg = Number(s.effectiveRate ?? s.rate ?? 0);
      if (!Number.isFinite(avg) || avg <= 0) return null;
      const marginal = Number(s.marginalRate ?? 0);
      return {
        averageRate: avg,
        marginalRateEstimate: Number.isFinite(marginal) && marginal > 0 ? marginal : Math.min(avg + 5, 40),
        source: data.kind as "income_tax" | "source_tax" | "tax_global",
        lastUpdated: data.created_at,
      };
    },
  });
}
