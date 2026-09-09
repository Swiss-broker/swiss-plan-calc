// src/routes/onboarding.$token.tsx
// Route publique (hors layout _app, comme /client-upload/$token) : finalise
// la création de compte d'un courtier après un paiement commercial généré
// via generate-offer -> handle-conversion -> email d'invitation.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/onboarding/$token")({
  head: () => ({ meta: [{ title: "Finaliser mon compte · SwissBroker Pro" }] }),
  component: OnboardingPage,
});

type InviteInfo = { email: string; plan: string };

const PLAN_LABELS: Record<string, string> = { starter: "Starter", pro: "Pro", cabinet: "Cabinet" };

const ERROR_MESSAGES: Record<string, string> = {
  INVITE_NOT_FOUND: "Ce lien n'existe pas ou a été supprimé.",
  INVITE_EXPIRED: "Ce lien a expiré. Contactez votre interlocuteur SwissBroker Pro pour en obtenir un nouveau.",
  INVITE_REVOKED: "Ce lien a été révoqué.",
  INVITE_USED: "Ce lien a déjà été utilisé. Si vous avez déjà un compte, connectez-vous directement.",
  PASSWORD_TOO_SHORT: "8 caractères minimum.",
  NAME_REQUIRED: "Prénom et nom sont requis.",
  EMAIL_ALREADY_REGISTERED: "Un compte existe déjà avec cet email. Connectez-vous directement.",
  ACCOUNT_CREATE_FAILED: "Impossible de créer le compte. Réessayez ou contactez le support.",
  PROFILE_UPDATE_FAILED: "Une erreur est survenue lors de la finalisation du profil. Contactez le support.",
};

// Même pattern que src/routes/client-upload.$token.tsx : le SDK Supabase
// expose l'erreur HTTP d'une Edge Function via error.context (une Response
// dont le corps JSON contient le code d'erreur métier).
async function extractErrorCode(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch {
      // corps non exploitable, on retombe sur le message générique
    }
  }
  return null;
}

const onboardingSchema = z
  .object({
    password: z.string().min(8, "8 caractères minimum"),
    confirmPassword: z.string().min(1, "Confirmez le mot de passe"),
    firstName: z.string().trim().min(1, "Prénom requis"),
    lastName: z.string().trim().min(1, "Nom requis"),
    brokerageName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

type OnboardingValues = z.infer<typeof onboardingSchema>;

function OnboardingPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { password: "", confirmPassword: "", firstName: "", lastName: "", brokerageName: "", phone: "" },
  });

  useEffect(() => {
    let cancelled = false;
    void supabase.functions
      .invoke("verify-onboarding-token", { body: { token } })
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error || data?.error) {
          const code = data?.error ?? (await extractErrorCode(error)) ?? "INVITE_NOT_FOUND";
          setLoadError(ERROR_MESSAGES[code] || "Lien invalide.");
          return;
        }
        setInvite(data as InviteInfo);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Impossible de joindre le serveur.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmit = async (values: OnboardingValues) => {
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("complete-onboarding", {
      body: {
        token,
        password: values.password,
        first_name: values.firstName,
        last_name: values.lastName,
        brokerage_name: values.brokerageName || undefined,
        phone: values.phone || undefined,
      },
    });

    if (error || data?.error) {
      const code = data?.error ?? (await extractErrorCode(error)) ?? "ACCOUNT_CREATE_FAILED";
      toast.error(ERROR_MESSAGES[code] || "Une erreur est survenue.");
      setSubmitting(false);
      // Un lien devenu invalide entre-temps (déjà utilisé par un autre
      // onglet, expiré pendant la saisie) : on bascule vers l'écran
      // d'erreur plutôt que de laisser un formulaire qui ne peut plus aboutir.
      if (code === "INVITE_EXPIRED" || code === "INVITE_REVOKED" || code === "INVITE_USED" || code === "INVITE_NOT_FOUND") {
        setInvite(null);
        setLoadError(ERROR_MESSAGES[code]);
      }
      return;
    }

    // Le compte est créé côté serveur (email_confirm=true) : on connecte
    // directement l'utilisateur avec les identifiants qu'il vient de saisir,
    // plutôt que de le renvoyer vers /auth pour se reconnecter — il a déjà
    // prouvé son intention en payant puis en cliquant le lien d'invitation,
    // un second écran de connexion n'ajouterait qu'une étape sans valeur.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: invite!.email,
      password: values.password,
    });
    setSubmitting(false);
    if (signInError) {
      // Compte créé mais connexion auto en échec (rare) : on ne bloque pas
      // le courtier, il peut se connecter manuellement avec son mot de passe.
      toast.success("Compte créé. Connectez-vous avec votre mot de passe.");
      navigate({ to: "/auth" });
      return;
    }
    toast.success("Bienvenue sur SwissBroker Pro !");
    navigate({ to: "/dashboard" });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle>Lien indisponible</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{loadError || "Lien invalide."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Finalisez votre compte</CardTitle>
          <CardDescription>
            Plan <strong>{PLAN_LABELS[invite.plan] || invite.plan}</strong> — il ne reste que quelques informations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={invite.email} readOnly disabled className="bg-muted" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Prénom</Label>
                <Input id="firstName" autoComplete="given-name" {...form.register("firstName")} />
                {form.formState.errors.firstName && (
                  <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Nom</Label>
                <Input id="lastName" autoComplete="family-name" {...form.register("lastName")} />
                {form.formState.errors.lastName && (
                  <p className="text-xs text-destructive">{form.formState.errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="brokerageName">Nom du cabinet (optionnel)</Label>
              <Input id="brokerageName" autoComplete="organization" {...form.register("brokerageName")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Téléphone (optionnel)</Label>
              <Input id="phone" type="tel" autoComplete="tel" {...form.register("phone")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="pr-10"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  className="pr-10"
                  {...form.register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" className="h-11 w-full shadow-elegant" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer mon compte
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
