// Déconnexion automatique après une période d'inactivité, active sur
// l'ensemble de l'application authentifiée (voir _app.tsx). Stratégie
// multi-onglets : le timestamp de dernière activité est centralisé dans
// localStorage (partagé entre tous les onglets du même navigateur) plutôt
// que gardé dans un état indépendant par onglet, car la session Supabase
// elle-même est déjà partagée entre onglets (voir AuthContext.tsx) — un
// minuteur isolé par onglet permettrait à un onglet resté ouvert en
// arrière-plan de déconnecter une session utilisée activement dans un
// autre onglet.
import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const IDLE_LIMIT_MS = 60 * 60 * 1000; // 1h
const CHECK_INTERVAL_MS = 30 * 1000;
const STORAGE_KEY = "sbp_last_activity";
const WRITE_THROTTLE_MS = 5 * 1000; // évite d'écrire dans localStorage à chaque événement

// Évènements comptant comme une vraie interaction utilisateur. Volontairement
// exclus : "mousemove" (trop bruyant, réinitialiserait le minuteur en continu
// sans intention réelle), et tout événement de visibilité/focus d'onglet ou
// d'appel réseau — changer d'onglet ou un rafraîchissement de données en
// arrière-plan ne doit jamais compter comme de l'activité.
const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "wheel"] as const;

function readLastActivity(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function useIdleLogout(enabled: boolean) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const loggedOutRef = useRef(false);
  const lastWriteRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    loggedOutRef.current = false;
    localStorage.setItem(STORAGE_KEY, String(Date.now()));

    const markActivity = () => {
      const now = Date.now();
      if (now - lastWriteRef.current < WRITE_THROTTLE_MS) return;
      lastWriteRef.current = now;
      localStorage.setItem(STORAGE_KEY, String(now));
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));

    const interval = setInterval(async () => {
      if (loggedOutRef.current) return;
      if (Date.now() - readLastActivity() < IDLE_LIMIT_MS) return;

      loggedOutRef.current = true;
      toast.warning("Vous avez été déconnecté(e) pour inactivité, veuillez vous reconnecter.");
      await signOut();
      navigate({ to: "/auth" });
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActivity));
      clearInterval(interval);
    };
  }, [enabled, navigate, signOut]);
}
