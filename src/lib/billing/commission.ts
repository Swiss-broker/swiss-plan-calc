// src/lib/billing/commission.ts
// Ré-export pur du module partagé : le front voit exactement le même
// calcul que les Edge Functions, jamais une copie des constantes.
export * from "../../../supabase/functions/_shared/commission.ts";
