// src/components/billing/AdvantagesModal.tsx
// Fenêtre "Avantages" (ristournes, commission 40-50‰) affichée UNE SEULE
// FOIS, uniquement pour un abonné payant (plan "active") qui vient
// d'obtenir l'accès, jamais avant paiement ni sur la landing page. Montée
// dans _app.tsx, APRÈS la porte d'abonnement (SubscriptionRequired) :
// n'affecte en rien la logique de cette porte, se contente de s'ajouter
// au-dessus une fois qu'on y est déjà passé.
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { usePlan } from "@/contexts/PlanContext";
import { useGuide } from "@/contexts/GuideContext";
import { useAdvantagesStatus } from "@/hooks/useAdvantagesStatus";
import { AdvantagesContent, CALCOM_ADVANTAGES_URL } from "@/components/billing/AdvantagesContent";

const ADVANTAGES_GUIDE_ID = "advantages-modal";

export function AdvantagesModal() {
  const { plan, isLoading: planLoading } = usePlan();
  const { hasSeenGuide, markGuideSeen, isLoading: guideLoading } = useGuide();
  const { callDone, isLoading: statusLoading, setCallDone } = useAdvantagesStatus();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  const ready = !planLoading && !guideLoading && !statusLoading;

  useEffect(() => {
    if (!ready) return;
    if (plan === "active" && !hasSeenGuide(ADVANTAGES_GUIDE_ID)) {
      setChecked(callDone ?? false);
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, plan]);

  const handleClose = () => {
    setOpen(false);
    void markGuideSeen(ADVANTAGES_GUIDE_ID);
    if (checked) void setCallDone(true);
  };

  const handleBook = () => {
    window.open(CALCOM_ADVANTAGES_URL, "_blank", "noopener,noreferrer");
    handleClose();
  };

  if (!ready || plan !== "active") return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vos avantages SwissBroker Pro</DialogTitle>
          <DialogDescription>
            Avant de commencer, voici comment fonctionnent deux avantages clés de votre cotisation.
          </DialogDescription>
        </DialogHeader>
        <AdvantagesContent />
        <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(Boolean(v))} />
          <span>J'ai déjà eu mon rendez-vous avec l'équipe au sujet de ces avantages</span>
        </label>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClose}>
            Continuer vers mon tableau de bord
          </Button>
          <Button onClick={handleBook}>Réserver un appel avec l'équipe</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
