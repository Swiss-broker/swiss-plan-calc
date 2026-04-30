// Hook universel pour les calculateurs : si l'URL contient ?clientId=xxx,
// charge le dossier client et retourne le mapping pré-rempli pour le calculateur.
// En mode standalone (pas de clientId), retourne null sans aucun fetch.

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  toIncomeTaxInput,
  toSourceTaxInput,
  toCrossBorderInput,
  toTouInput,
  toLppInput,
  toVestedBenefitsInput,
  toPillar3aInput,
  toCantonCompareInput,
  toRetirementInput,
  stripUndefined,
  type ClientBundle,
} from "@/lib/clients/to-calculator-input";
import type { Client, ClientPension, ClientAssets } from "@/lib/clients/types";

export type CalculatorKind =
  | "income-tax"
  | "source-tax"
  | "cross-border"
  | "tou"
  | "lpp"
  | "vested-benefits"
  | "pillar3a"
  | "canton-compare"
  | "retirement";

const MAPPERS = {
  "income-tax": toIncomeTaxInput,
  "source-tax": toSourceTaxInput,
  "cross-border": toCrossBorderInput,
  tou: toTouInput,
  lpp: toLppInput,
  "vested-benefits": toVestedBenefitsInput,
  pillar3a: toPillar3aInput,
  "canton-compare": toCantonCompareInput,
  retirement: toRetirementInput,
} as const;

export interface PrefillResult<K extends CalculatorKind> {
  client: Client | null;
  bundle: ClientBundle | null;
  prefill: ReturnType<(typeof MAPPERS)[K]> | null;
  isLoading: boolean;
  error: Error | null;
}

export function usePrefillFromClient<K extends CalculatorKind>(
  clientId: string | undefined,
  kind: K,
): PrefillResult<K> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["client-bundle", clientId],
    enabled: Boolean(clientId),
    queryFn: async (): Promise<ClientBundle | null> => {
      if (!clientId) return null;
      const [c, p, a] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).single(),
        supabase.from("client_pension").select("*").eq("client_id", clientId).maybeSingle(),
        supabase.from("client_assets").select("*").eq("client_id", clientId).maybeSingle(),
      ]);
      if (c.error) throw c.error;
      return {
        client: c.data as Client,
        pension: (p.data as ClientPension | null) ?? null,
        assets: (a.data as ClientAssets | null) ?? null,
      };
    },
  });

  if (!clientId) {
    return { client: null, bundle: null, prefill: null, isLoading: false, error: null };
  }

  const bundle = data ?? null;
  const prefill = bundle
    ? (MAPPERS[kind](bundle) as ReturnType<(typeof MAPPERS)[K]>)
    : null;

  return {
    client: bundle?.client ?? null,
    bundle,
    prefill,
    isLoading,
    error: (error as Error | null) ?? null,
  };
}

/**
 * Helper : hydrate UNE SEULE FOIS un useState form avec les valeurs prefill,
 * en ignorant les undefined (pour préserver les défauts du calculateur).
 * Les modifications "what-if" du courtier ne sont JAMAIS écrasées.
 */
export function useHydrateFormFromPrefill<T extends Record<string, unknown>>(
  prefill: Partial<T> | null,
  setForm: (updater: (prev: T) => T) => void,
) {
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (prefill && !hydratedRef.current) {
      setForm((prev) => ({ ...prev, ...stripUndefined(prefill as Record<string, unknown>) }) as T);
      hydratedRef.current = true;
    }
  }, [prefill, setForm]);
}
