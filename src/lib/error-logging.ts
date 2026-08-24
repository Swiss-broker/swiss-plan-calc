// Journalise une erreur côté client dans client_errors, pour donner à
// l'équipe une visibilité qu'elle n'avait pas : un bug ne devrait plus être
// visible seulement si le courtier prend la peine d'envoyer un feedback.
// Best-effort : ne doit jamais lui-même faire planter l'app ni bloquer quoi
// que ce soit si l'insertion échoue (hors ligne, session expirée, etc.).
import { supabase } from "@/integrations/supabase/client";

let lastLoggedKey = "";
let lastLoggedAt = 0;

export async function logClientError(message: string, stack?: string, context?: Record<string, unknown>) {
  try {
    // Anti-répétition simple : évite de spammer la table si la même erreur
    // se déclenche en boucle (ex. un effet React qui re-throw en continu).
    const key = `${message}::${stack ?? ""}`;
    const now = Date.now();
    if (key === lastLoggedKey && now - lastLoggedAt < 10_000) return;
    lastLoggedKey = key;
    lastLoggedAt = now;

    const { data } = await supabase.auth.getSession();
    const brokerId = data.session?.user?.id;
    if (!brokerId) return; // pas de log pour les pages non authentifiées (V1)

    await supabase.from("client_errors").insert({
      broker_id: brokerId,
      message: message.slice(0, 2000),
      stack: stack?.slice(0, 8000) ?? null,
      url: typeof window !== "undefined" ? window.location.href : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      context: (context ?? null) as never,
    });
  } catch {
    // Ne jamais faire échouer l'app à cause du logger d'erreurs lui-même.
  }
}

/** À appeler une fois au démarrage de l'app : capture les erreurs JS non
 *  catchées et les rejets de promesse non gérés, en dehors de l'arbre React. */
export function installGlobalErrorLogging() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (event) => {
    logClientError(event.message || "Erreur inconnue", event.error?.stack);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    logClientError(`Promesse rejetée : ${message}`, stack);
  });
}
