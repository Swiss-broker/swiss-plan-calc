// src/lib/billing/plans.ts
// Point unique de vérité pour les plans facturables (évite d'avoir 3
// copies divergentes des price_id Stripe entre auth.tsx, auth/confirm.tsx
// et la porte d'accès de _app.tsx).
import type { BrokerPlan } from "@/contexts/PlanContext";

export type BillablePlan = "starter" | "pro" | "cabinet";

export const PRICE_IDS: Record<BillablePlan, string> = {
  starter: import.meta.env.VITE_STRIPE_STARTER_MONTHLY ?? "",
  pro: import.meta.env.VITE_STRIPE_PRO_MONTHLY ?? "",
  cabinet: import.meta.env.VITE_STRIPE_CABINET_MONTHLY ?? "",
};

export const PLAN_LABELS: Record<BillablePlan, string> = {
  starter: "Starter",
  pro: "Pro",
  cabinet: "Cabinet",
};

// Plans qui donnent un accès réel à l'application : abonnement individuel
// payé (starter/pro), siège cabinet payé par quelqu'un (cabinet), ou
// compte interne (fondatrice, associé). "trial" est un état transitoire
// entre la vérification du code par email et le paiement Stripe — il ne
// doit jamais suffire à lui seul pour accéder à l'application, sans quoi
// n'importe qui peut créer un compte et utiliser le produit gratuitement
// sans jamais payer. Voir _app.tsx pour l'application de cette règle.
export const ACTIVE_PLANS: ReadonlySet<BrokerPlan> = new Set(["starter", "pro", "cabinet", "internal"]);
