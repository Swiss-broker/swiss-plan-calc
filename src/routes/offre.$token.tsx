// src/routes/offre.$token.tsx
// Route publique : lien d'offre envoyé à un prospect. Crée une page de
// paiement Stripe neuve à chaque ouverture (voir supabase/functions/
// open-offer) puis y redirige, pour que le lien reste valable pendant toute
// la durée de l'offre au lieu des 24 h d'une page Stripe.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/offre/$token")({
  head: () => ({ meta: [{ title: "Votre offre · SwissBroker Pro" }] }),
  component: OfferPage,
});

const MESSAGES: Record<string, { title: string; body: string; done?: boolean }> = {
  OFFER_NOT_FOUND: {
    title: "Lien introuvable",
    body: "Ce lien d'offre n'existe pas. Vérifiez qu'il a été copié en entier, ou contactez votre interlocuteur SwissBroker Pro.",
  },
  OFFER_EXPIRED: {
    title: "Offre expirée",
    body: "Cette offre n'est plus valable. Contactez votre interlocuteur SwissBroker Pro pour en recevoir une nouvelle.",
  },
  OFFER_ALREADY_PAID: {
    title: "Paiement déjà reçu",
    body: "Cette offre a déjà été réglée. Vous avez reçu par e-mail le lien pour créer votre compte.",
    done: true,
  },
};

async function errorCode(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch {
      // corps illisible : message générique
    }
  }
  return null;
}

function OfferPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<"loading" | "error">("loading");
  const [code, setCode] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    (async () => {
      const { data, error } = await supabase.functions.invoke("open-offer", { body: { token } });
      if (cancelled) return;
      if (!error && data?.url) {
        window.location.replace(data.url as string);
        return;
      }
      setCode(await errorCode(error));
      setState("error");
    })();
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  const msg = (code && MESSAGES[code]) || {
    title: "Paiement momentanément indisponible",
    body: "La page de paiement n'a pas pu s'ouvrir. Réessayez dans un instant ; si le problème persiste, contactez votre interlocuteur SwissBroker Pro.",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        {state === "loading" ? (
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Ouverture de la page de paiement sécurisée…</p>
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {msg.done ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-warning" />
                )}
                {msg.title}
              </CardTitle>
              <CardDescription>{msg.body}</CardDescription>
            </CardHeader>
            {!code && (
              <CardContent>
                <Button onClick={() => setAttempt((n) => n + 1)}>Réessayer</Button>
              </CardContent>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
