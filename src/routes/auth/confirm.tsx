import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const confirmSearchSchema = z.object({
  plan: z.enum(["starter", "pro", "cabinet"]).optional(),
  email: z.string().optional(),
});

export const Route = createFileRoute("/auth/confirm")({
  validateSearch: (s) => confirmSearchSchema.parse(s),
  component: ConfirmPage,
});

const PRICE_IDS: Record<string, string> = {
  starter: import.meta.env.VITE_STRIPE_STARTER_MONTHLY ?? "",
  pro: import.meta.env.VITE_STRIPE_PRO_MONTHLY ?? "",
  cabinet: import.meta.env.VITE_STRIPE_CABINET_MONTHLY ?? "",
};

function ConfirmPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const plan = search.plan ?? "pro";
  const emailFromSearch = search.email ?? "";

  const [email, setEmail] = useState(emailFromSearch);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Vérifie le code OTP avec Supabase
    const { data, error: otpError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    });

    if (otpError || !data.session) {
      setLoading(false);
      setError("Code incorrect ou expiré. Vérifiez le code reçu par email.");
      return;
    }

    // Code valide — on lance Stripe
    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      navigate({ to: "/dashboard" });
      return;
    }

    try {
      const { data: stripeData, error: fnError } = await supabase.functions.invoke("stripe-checkout", {
        body: {
          priceId,
          brokerId: data.session.user.id,
          brokerEmail: data.session.user.email,
          plan,
        },
      });
      if (fnError || !stripeData?.url) throw new Error("Erreur Stripe");
      window.location.href = stripeData.url;
    } catch {
      setError("Erreur lors de la redirection vers le paiement. Contactez le support.");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-hero flex items-center justify-center px-4">
      <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant">
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <span className="text-3xl">📧</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Vérifiez vos emails</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Saisissez le code à 6 chiffres reçu par email pour continuer.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Votre email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="token">Code de confirmation</Label>
            <Input
              id="token"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="text-center text-2xl tracking-widest font-bold"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button type="submit" className="h-11 w-full shadow-elegant" disabled={loading || token.length !== 6}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmer et accéder au paiement
          </Button>
        </form>

        <div className="mt-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
            Vous ne trouvez pas l'email ?
          </p>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground text-center">
              Vérifiez vos <strong>courriers indésirables</strong>.<br />
              Expéditeur : <strong>noreply@swissbrokerpro.ch</strong>
            </p>
          </div>
        </div>

        <div className="mt-4 text-center">
          <a href="/auth?mode=signup" className="text-xs text-muted-foreground hover:text-foreground underline">
            Recommencer l'inscription
          </a>
        </div>
      </div>
    </div>
  );
}
