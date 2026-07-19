// src/components/CompleteProfileModal.tsx
// Pop-up affichee tant que le profil courtier n'est pas complet
// (prenom, nom, compte bancaire Stripe Connect). Objectif : eviter que le
// courtier decouvre le blocage seulement au moment de facturer un client.
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function CompleteProfileModal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState<{ identity: boolean; bank: boolean }>({
    identity: false,
    bank: false,
  });
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Admins n'ont pas d'entree dans profiles, ce n'est pas un cas a traiter ici
    let cancelled = false;
    (async () => {
      const [{ data: profile }, { data: connect }] = await Promise.all([
        supabase.from("profiles").select("first_name,last_name").eq("id", user.id).maybeSingle(),
        supabase
          .from("broker_connect_accounts")
          .select("onboarding_complete")
          .eq("broker_id", user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const identityMissing = !profile?.first_name?.trim() || !profile?.last_name?.trim();
      const bankMissing = !connect?.onboarding_complete;
      setMissing({ identity: identityMissing, bank: bankMissing });
      // Ne s'affiche que si quelque chose manque, et pas si le courtier l'a deja
      // ferme cette session (evite de le harceler a chaque changement de page).
      const dismissedThisSession = sessionStorage.getItem("profile-modal-dismissed") === "true";
      if ((identityMissing || bankMissing) && !dismissedThisSession) {
        setOpen(true);
      }
      setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleDismiss = () => {
    sessionStorage.setItem("profile-modal-dismissed", "true");
    setOpen(false);
  };

  const handleGoToProfile = () => {
    setOpen(false);
    navigate({ to: "/account" });
  };

  if (!checked) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleDismiss())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <DialogTitle>Complétez votre profil</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-left">
            Pour pouvoir facturer vos rendez-vous et générer les dossiers de
            synthèse PDF pour vos clients, il manque encore quelques
            informations sur votre profil :
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          {missing.identity && (
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>Votre <strong>nom et prénom</strong>, affichés sur les rapports envoyés à vos clients.</span>
            </li>
          )}
          {missing.bank && (
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>Votre <strong>compte bancaire</strong> (via Stripe Connect), indispensable pour encaisser le paiement de vos rendez-vous.</span>
            </li>
          )}
        </ul>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleDismiss}>
            Plus tard
          </Button>
          <Button onClick={handleGoToProfile}>Compléter mon profil</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}