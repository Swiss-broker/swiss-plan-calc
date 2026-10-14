// src/hooks/useAdvantagesStatus.ts
// État partagé "avantages" (ristournes, commission 40-50‰) : la case
// advantages_call_done côté fiche profil, lue et écrite depuis la fenêtre
// post-paiement, la bannière de rappel mensuelle et l'onglet "Avantages" du
// profil, pour qu'une mise à jour faite à un endroit se reflète partout.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useAdvantagesStatus() {
  const { user } = useAuth();
  const [callDone, setCallDone] = useState<boolean | null>(null);
  const [reminderLastShownAt, setReminderLastShownAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("advantages_call_done, advantages_reminder_last_shown_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setCallDone(data?.advantages_call_done ?? false);
        setReminderLastShownAt(data?.advantages_reminder_last_shown_at ?? null);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // user?.id (pas l'objet user) : Supabase émet un nouvel objet user à
    // chaque rafraîchissement automatique du token (typiquement au refocus
    // de l'onglet) même sans changement d'utilisateur — voir le même
    // correctif dans PlanContext.tsx et GuideContext.tsx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setCallDoneRemote = useCallback(
    async (done: boolean) => {
      if (!user) return;
      setCallDone(done);
      await supabase.from("profiles").update({ advantages_call_done: done }).eq("id", user.id);
    },
    [user],
  );

  const markReminderShown = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    setReminderLastShownAt(now);
    await supabase
      .from("profiles")
      .update({ advantages_reminder_last_shown_at: now })
      .eq("id", user.id);
  }, [user]);

  return {
    callDone,
    reminderLastShownAt,
    isLoading,
    setCallDone: setCallDoneRemote,
    markReminderShown,
  };
}
