// src/lib/billing/plans.ts
// Libellés des plans facturables et liste des plans donnant un accès réel
// à l'application (ACTIVE_PLANS, lue par la porte d'accès de _app.tsx).
// Les price_id Stripe eux-mêmes (VITE_STRIPE_*) ont été retirés : le
// parcours self-serve générique est fermé (voir auth.tsx), seule
// l'invitation cabinet reste ouverte, avec un price_id différent (siège
// cabinet) codé dans cabinet-add-seat.
import type { BrokerPlan } from "@/contexts/PlanContext";

export type BillablePlan = "starter" | "pro" | "cabinet";

export const PLAN_LABELS: Record<BillablePlan, string> = {
  starter: "Starter",
  pro: "Pro",
  cabinet: "Cabinet",
};

// Plans qui donnent un accès réel à l'application : cotisation annuelle
// payée ("active", nouveau modèle économique), compte interne (fondatrice,
// associé), ou compte démo. "trial" est un état transitoire entre la
// vérification du code par email et le paiement Stripe — il ne doit jamais
// suffire à lui seul pour accéder à l'application, sans quoi n'importe qui
// peut créer un compte et utiliser le produit gratuitement sans jamais
// payer. Voir _app.tsx pour l'application de cette règle.
//
// starter/pro/cabinet restent ici pour les comptes déjà existants sous
// l'ancien modèle (plus aucun nouveau compte ne peut désormais obtenir
// l'une de ces valeurs) — retirés en Phase 5 avec le reste du cabinet.
export const ACTIVE_PLANS: ReadonlySet<BrokerPlan> = new Set([
  "active",
  "starter",
  "pro",
  "cabinet",
  "internal",
  "demo",
]);
