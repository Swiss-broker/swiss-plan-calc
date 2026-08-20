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
  toAvsAiInput,
  toInvestmentCompareInput,
  toHealthInsuranceFranceInput,
  toOvertimeInput,
  toTaxGlobalInput,
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
  | "retirement"
  | "avs-ai"
  | "investment-compare"
  | "health-insurance-france"
  | "overtime"
  | "tax-global";

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
  "avs-ai": toAvsAiInput,
  "investment-compare": toInvestmentCompareInput,
  "health-insurance-france": toHealthInsuranceFranceInput,
  overtime: toOvertimeInput,
  "tax-global": toTaxGlobalInput,
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
 * Champs « identité fiscale » qui doivent toujours rester en phase avec la
 * fiche client. Si le courtier modifie l'état civil / canton / enfants /
 * confession dans la fiche, ces valeurs sont resynchronisées sur le
 * calculateur (même après l'hydratation initiale). Les autres champs
 * (salaire, hypothèses, what-if) ne sont JAMAIS écrasés après hydratation.
 */
const IDENTITY_FIELDS = ["status", "canton", "children", "childrenAges", "confession"] as const;

/**
 * Helper : hydrate UNE SEULE FOIS un useState form avec les valeurs prefill,
 * en ignorant les undefined (pour préserver les défauts du calculateur).
 * Les modifications "what-if" du courtier ne sont JAMAIS écrasées —
 * EXCEPTION : les champs identité fiscale (état civil, canton, enfants,
 * confession) sont resynchronisés en continu depuis la fiche client.
 */
export function useHydrateFormFromPrefill<T extends Record<string, unknown>>(
  prefill: Partial<T> | null,
  setForm: (updater: (prev: T) => T) => void,
) {
  const hydratedRef = useRef(false);
  // Mémoïse les dernières valeurs identité connues pour détecter les changements.
  const lastIdentityRef = useRef<Record<string, unknown>>({});
  useEffect(() => {
    if (!prefill) return;
    if (!hydratedRef.current) {
      // 1re hydratation : on copie tout (sauf undefined).
      setForm((prev) => ({ ...prev, ...stripUndefined(prefill as Record<string, unknown>) }) as T);
      hydratedRef.current = true;
      for (const k of IDENTITY_FIELDS) {
        lastIdentityRef.current[k] = (prefill as Record<string, unknown>)[k];
      }
      return;
    }
    // Hydratations suivantes : on resynchronise uniquement l'identité fiscale
    // si elle a changé côté fiche client.
    const patch: Record<string, unknown> = {};
    for (const k of IDENTITY_FIELDS) {
      const next = (prefill as Record<string, unknown>)[k];
      if (next === undefined) continue;
      if (next !== lastIdentityRef.current[k]) {
        patch[k] = next;
        lastIdentityRef.current[k] = next;
      }
    }
    if (Object.keys(patch).length > 0) {
      setForm((prev) => ({ ...prev, ...patch }) as T);
    }
  }, [prefill, setForm]);
}

