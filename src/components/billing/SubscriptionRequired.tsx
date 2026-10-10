// src/components/billing/SubscriptionRequired.tsx
// Porte de paiement affichée à la place du tableau de bord tant que le
// compte n'a pas d'abonnement actif (voir _app.tsx et
// src/lib/billing/plans.ts pour le pourquoi). Le compte existe déjà (email
// vérifié à l'inscription) mais le paiement n'a jamais abouti ou a échoué
// — on propose donc de le reprendre directement, plutôt que de renvoyer
// vers une prise de rendez-vous démo qui n'a pas de sens pour quelqu'un
// qui a déjà un compte.
import { useState } from "react";
import { Loader2, ArrowLeft, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const CALCOM_URL = "https://cal.com/swissbroker/30min";

export function SubscriptionRequired({
  email,
  onSignOut,
}: {
  email: string;
  onSignOut: () => Promise<void>;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const [paying, setPaying] = useState(false);

  // Navigation "dure" (window.location) plutôt que le routeur SPA : le seul
  // mécanisme existant pour rediriger après déconnexion est un effet
  // réactif dans _app.tsx (navigate() déclenché quand isAuthenticated
  // repasse à false) — indirect et non garanti au clic. Un vrai
  // rechargement de page ignore cet état React et atterrit toujours sur
  // "/", quel que soit le timing de la déconnexion.
  const handleReturnToSite = async () => {
    setSigningOut(true);
    await onSignOut();
    window.location.href = "/";
  };

  const handlePay = async () => {
    setPaying(true);
    const { data, error } = await supabase.functions.invoke("stripe-checkout", { body: {} });
    if (error || !data?.url) {
      toast.error("Erreur lors de la redirection vers le paiement. Réessayez dans un instant.");
      setPaying(false);
      return;
    }
    window.location.href = data.url;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-hero flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-elegant">
          <span className="text-xl font-bold text-primary-foreground">S</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Abonnement requis</h1>
        <p className="mt-1 mb-5 text-xs text-muted-foreground">{email}</p>

        <p className="text-sm text-muted-foreground">
          Votre compte n'a pas (ou plus) de cotisation annuelle active. Réglez les 99 CHF/an pour
          débloquer l'accès illimité à tous les calculateurs.
        </p>

        <Button onClick={handlePay} disabled={paying} className="mt-5 h-11 w-full shadow-elegant">
          {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          Payer la cotisation annuelle — 99 CHF/an
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">
          Une question avant de payer ?{" "}
          <a href={CALCOM_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Réservez un appel avec notre équipe
          </a>
          .
        </p>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={handleReturnToSite}
            disabled={signingOut}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground underline"
          >
            {signingOut ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowLeft className="h-3 w-3" />}
            Retour au site
          </button>
        </div>
      </div>
    </div>
  );
}
