// src/components/billing/SelfServeClosedNotice.tsx
// Message partagé partout où le self-serve générique est fermé
// (src/routes/auth.tsx pour /auth?mode=signup, et SubscriptionRequired
// pour tout compte non actif) : un seul texte à faire évoluer, pas une
// copie dupliquée par écran.
export const CALCOM_URL = "https://cal.com/swissbroker/30min";

export function SelfServeClosedNotice({ message }: { message?: string }) {
  return (
    <div className="space-y-5 text-center">
      <p className="text-sm text-muted-foreground">
        {message ?? "La création de compte en libre-service n'est plus disponible."}{" "}
        Réservez une démo avec notre équipe pour découvrir SwissBroker Pro et obtenir votre accès.
      </p>
      <a
        href={CALCOM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-elegant transition-all hover:bg-primary/90"
      >
        Réserver une démo
      </a>
    </div>
  );
}
