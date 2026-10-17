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

/** Distingue "la donnée existe, y compris si elle vaut 0" de "la donnée
 *  est absente" — contrairement à `Number(v ?? 0)` qui rend les deux
 *  indiscernables. */
function numOrUndef(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

// Filtré par dossier (case_id) : une simulation fiscale enregistrée dans
// un dossier ne doit jamais être reprise comme référence dans un AUTRE
// dossier du même client, sinon un courtier voit un taux marginal qui ne
// correspond pas du tout au scénario du dossier ouvert. Sans caseId (accès
// hors dossier, ex. lien direct historique), on se limite au dossier
// virtuel "historique" (case_id NULL) plutôt que de retomber sur tout le
// client — jamais de fuite entre dossiers.
export function useClientFiscalSnapshot(clientId: string | undefined, caseId: string | undefined) {
  return useQuery({
    queryKey: ["client-fiscal-snapshot", clientId, caseId],
    enabled: Boolean(clientId),
    queryFn: async (): Promise<ClientFiscalSnapshot | null> => {
      if (!clientId) return null;
      let query = supabase
        .from("simulation_history")
        .select("kind, summary, created_at")
        .eq("client_id", clientId)
        .in("kind", ["income_tax", "source_tax", "tax_global"]);
      query = caseId ? query.eq("case_id", caseId) : query.is("case_id", null);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      const s = (data.summary ?? {}) as Record<string, unknown>;
      // income_tax et tax_global stockent effectiveRate/marginalRate ;
      // source_tax stocke rate. numOrUndef distingue "la donnée existe et
      // vaut 0" (taux parfaitement possible pour un revenu bas, dans la
      // tranche exonérée) de "la donnée n'a jamais été sauvegardée" — avant
      // ce correctif, `?? 0` puis `> 0` traitaient un taux à 0% comme
      // absent et retombaient sur l'estimation approximative (taux moyen +
      // 5 points) au lieu du vrai taux marginal du fiscal global, créant un
      // écart entre les deux calculateurs (cahier des charges point 14).
      const avg = numOrUndef(s.effectiveRate) ?? numOrUndef(s.rate);
      if (avg === undefined) return null;
      const marginal = numOrUndef(s.marginalRate);
      return {
        averageRate: avg,
        marginalRateEstimate: marginal !== undefined ? marginal : Math.min(avg + 5, 40),
        source: data.kind as "income_tax" | "source_tax" | "tax_global",
        lastUpdated: data.created_at,
      };
    },
  });
}
