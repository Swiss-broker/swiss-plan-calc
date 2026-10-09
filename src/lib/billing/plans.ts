// src/lib/billing/plans.ts
// Libellés des plans facturables et liste des plans donnant un accès réel
// à l'application (ACTIVE_PLANS, lue par la porte d'accès de _app.tsx).
// Le parcours self-serve générique est fermé (voir auth.tsx) ; BillablePlan
// et PLAN_LABELS ne servent plus qu'à afficher le message de fermeture pour
// d'anciens liens ?plan=starter/pro/cabinet encore en circulation.
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
// starter/pro/cabinet (Phase 5) : désactivés avec le reste du cabinet — un
// compte encore sur l'une de ces valeurs (ancien modèle, aucun nouveau
// compte ne peut plus les obtenir) voit désormais la porte d'abonnement,
// comme un compte "expired". Les valeurs restent lisibles ailleurs
// (account.tsx) pour ne pas casser l'affichage des comptes historiques.
export const ACTIVE_PLANS: ReadonlySet<BrokerPlan> = new Set([
  "active",
  "internal",
  "demo",
]);
