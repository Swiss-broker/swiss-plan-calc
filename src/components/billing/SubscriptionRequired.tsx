// src/components/billing/SubscriptionRequired.tsx
// Porte de paiement affichée à la place du tableau de bord tant que le
// compte n'a pas d'abonnement actif (voir _app.tsx et
// src/lib/billing/plans.ts pour le pourquoi).
import { useState } from "react";
import { Loader2, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PRICE_IDS, PLAN_LABELS, type BillablePlan } from "@/lib/billing/plans";

const PLAN_DESCRIPTIONS: Record<BillablePlan, string> = {
  starter: "10 clients max · tous les calculateurs · PDF et IA illimités",
  pro: "20 clients max · tous les calculateurs · PDF et IA illimités",
  cabinet: "Clients illimités · gestion multi-courtiers · support dédié",
};

export function SubscriptionRequired({
  email,
  userId,
  onSignOut,
}: {
  email: string;
  userId: string;
  onSignOut: () => Promise<void>;
}) {
  const [loadingPlan, setLoadingPlan] = useState<BillablePlan | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async (plan: BillablePlan) => {
    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      setError("Ce plan n'est pas disponible pour le moment. Contactez le support.");
      return;
    }
    setLoadingPlan(plan);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("stripe-checkout", {
        body: { priceId, brokerId: userId, brokerEmail: email, plan },
      });
      if (fnError || !data?.url) throw new Error("Erreur Stripe");
      window.location.href = data.url;
    } catch {
      setError("Erreur lors de la redirection vers le paiement. Contactez le support.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-hero flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-elegant">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <ShieldAlert className="h-7 w-7 text-amber-700" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Abonnement requis</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre email est confirmé, mais l'accès à SwissBroker Pro nécessite un abonnement actif.
            Choisissez un plan pour continuer — 3 jours d'essai, aucun débit avant J+3.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{email}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(Object.keys(PRICE_IDS) as BillablePlan[]).map((plan) => (
            <div key={plan} className="flex flex-col rounded-xl border border-border p-4">
              <span className="font-semibold">{PLAN_LABELS[plan]}</span>
              <span className="mt-1 flex-1 text-xs text-muted-foreground">{PLAN_DESCRIPTIONS[plan]}</span>
              <Button
                onClick={() => startCheckout(plan)}
                disabled={loadingPlan !== null}
                className="mt-3 gap-2"
                variant={plan === "pro" ? "default" : "outline"}
              >
                {loadingPlan === plan && <Loader2 className="h-4 w-4 animate-spin" />}
                Choisir {PLAN_LABELS[plan]}
              </Button>
            </div>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-destructive text-center">{error}</p>}

        <p className="mt-6 text-xs text-muted-foreground text-center">
          Vous venez de payer ? Le déblocage peut prendre quelques secondes —{" "}
          <button type="button" onClick={() => window.location.reload()} className="underline hover:text-foreground">
            rafraîchissez la page
          </button>
          .
        </p>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={async () => {
              setSigningOut(true);
              await onSignOut();
            }}
            disabled={signingOut}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground underline"
          >
            {signingOut ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />}
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
