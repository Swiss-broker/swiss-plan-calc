// src/components/billing/AdvantagesReminderBanner.tsx
// Bannière discrète, dismissible, affichée au maximum une fois par mois sur
// le tableau de bord tant que le courtier abonné n'a pas coché "j'ai déjà eu
// mon rendez-vous" (voir AdvantagesContent / account.tsx, onglet Avantages).
import { X } from "lucide-react";
import { usePlan } from "@/contexts/PlanContext";
import { useAdvantagesStatus } from "@/hooks/useAdvantagesStatus";
import { CALCOM_ADVANTAGES_URL } from "@/components/billing/AdvantagesContent";

const REMINDER_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export function AdvantagesReminderBanner() {
  const { plan } = usePlan();
  const { callDone, reminderLastShownAt, isLoading, markReminderShown } = useAdvantagesStatus();

  if (plan !== "active" || isLoading || callDone) return null;
  const dueAgain =
    !reminderLastShownAt ||
    Date.now() - new Date(reminderLastShownAt).getTime() > REMINDER_INTERVAL_MS;
  if (!dueAgain) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
      <p className="text-foreground/90">
        Vous n'avez pas encore eu votre rendez-vous sur vos avantages (ristournes, commission).{" "}
        <a
          href={CALCOM_ADVANTAGES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Réserver un appel
        </a>
      </p>
      <button
        type="button"
        onClick={() => void markReminderShown()}
        aria-label="Fermer"
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
