// src/components/billing/SubscriptionRequired.tsx
// Porte de paiement affichée à la place du tableau de bord tant que le
// compte n'a pas d'abonnement actif (voir _app.tsx et
// src/lib/billing/plans.ts pour le pourquoi). Le self-serve générique
// étant fermé, cet écran ne propose plus de paiement direct : même
// message que SignupClosedNotice (src/routes/auth.tsx), vers la prise de
// rendez-vous démo.
import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { SelfServeClosedNotice } from "./SelfServeClosedNotice";

export function SubscriptionRequired({
  email,
  onSignOut,
}: {
  email: string;
  onSignOut: () => Promise<void>;
}) {
  const [signingOut, setSigningOut] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden bg-hero flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-elegant">
          <span className="text-xl font-bold text-primary-foreground">S</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Réservez une démo</h1>
        <p className="mt-1 mb-5 text-xs text-muted-foreground">{email}</p>

        <SelfServeClosedNotice />

        <div className="mt-6 text-center">
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
