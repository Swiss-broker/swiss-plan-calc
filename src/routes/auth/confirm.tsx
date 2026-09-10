import { createFileRoute } from "@tanstack/react-router";

const CALCOM_URL = "https://cal.com/swissbroker/30min";

export const Route = createFileRoute("/auth/confirm")({
  component: ConfirmPage,
});

// Ancienne page de confirmation OTP du self-serve générique, fermée en
// même temps que SignupForm (voir src/routes/auth.tsx) : cette page ne
// peut de toute façon plus recevoir de code OTP valide, puisque plus rien
// dans l'app n'appelle supabase.auth.signUp() en dehors du parcours
// d'invitation cabinet (qui, lui, ne passe jamais par cette page — voir
// l'écran OTP intégré à auth.tsx). Aucun contexte valide n'existe donc
// plus ici : le message est inconditionnel.
function ConfirmPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-hero flex items-center justify-center px-4">
      <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-elegant">
          <span className="text-xl font-bold text-primary-foreground">S</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Réservez une démo</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          La création de compte en libre-service n'est plus disponible. Réservez une démo avec notre équipe pour
          découvrir SwissBroker Pro et obtenir votre accès.
        </p>
        <a
          href={CALCOM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-elegant transition-all hover:bg-primary/90"
        >
          Réserver une démo
        </a>
      </div>
    </div>
  );
}
