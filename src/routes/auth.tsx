import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { PublicLanguageSwitcher } from "@/components/common/PublicLanguageSwitcher";
import { t as translate } from "@/lib/i18n";
import { PLAN_LABELS, type BillablePlan } from "@/lib/billing/plans";
import { SelfServeClosedNotice } from "@/components/billing/SelfServeClosedNotice";

const authSearchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  plan: z.enum(["starter", "pro", "cabinet"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => authSearchSchema.parse(s),
  head: () => ({
    meta: [
      { title: translate("auth.head.title") },
      { name: "description", content: translate("auth.head.desc") },
    ],
  }),
  component: AuthPage,
});

const signinSchema = z.object({
  email: z.string().trim().email("auth.error.email_invalid"),
  password: z.string().min(1, "auth.error.password_required"),
});

type SigninValues = z.infer<typeof signinSchema>;

function AuthPage() {
  const t = useT();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const selectedPlan = search.plan ?? "pro";

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: "/dashboard" });
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-hero">
      <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-4 py-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {t("auth.back_home")}
          </Link>
          <PublicLanguageSwitcher />
        </div>
        <div className="mt-12 rounded-2xl border border-border bg-card p-8 shadow-elegant">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-elegant">
              <span className="text-xl font-bold text-primary-foreground">S</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === "signup" ? "Réservez une démo" : t("auth.signin.title")}
            </h1>
          </div>

          {mode === "signup" ? (
            <SignupClosedNotice plan={selectedPlan as BillablePlan} />
          ) : (
            <SigninForm />
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? (
              <>
                {t("auth.toggle.have_account")}{" "}
                <button type="button" onClick={() => setMode("signin")} className="font-medium text-primary hover:underline">
                  {t("auth.toggle.signin")}
                </button>
              </>
            ) : (
              <>
                {t("auth.toggle.no_account")}{" "}
                <button type="button" onClick={() => setMode("signup")} className="font-medium text-primary hover:underline">
                  {t("auth.toggle.signup")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// L'inscription en libre-service générique est fermée : ce parcours ne
// crée plus de compte pour un visiteur qui n'a pas d'invitation cabinet
// (voir la garde sur search.invite dans AuthPage). Tout visiteur arrivant
// ici, par l'URL ou par le lien "Pas de compte ?", est redirigé vers la
// prise de rendez-vous démo, seul point d'entrée commercial désormais.
function SignupClosedNotice({ plan }: { plan: BillablePlan }) {
  const planLabel = PLAN_LABELS[plan];
  return (
    <SelfServeClosedNotice
      message={
        planLabel
          ? `La création de compte en libre-service n'est plus disponible pour le plan ${planLabel}.`
          : undefined
      }
    />
  );
}

function SigninForm() {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();
  const form = useForm<SigninValues>({
    resolver: zodResolver(signinSchema),
    defaultValues: { email: "", password: "" },
  });


  const onSubmit = async (values: SigninValues) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    setLoading(false);
    if (error) {
      toast.error(t("auth.error.bad_credentials"));
      return;
    }
    navigate({ to: "/dashboard" });
  };

  const onForgotPassword = async () => {
    const email = form.getValues("email");
    if (!email) {
      toast.error("Saisissez votre email d'abord.");
      return;
    }
    setResetLoading(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    setResetSent(true);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("auth.field.email")}</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t("auth.field.password")}</Label>
          <button
            type="button"
            onClick={onForgotPassword}
            disabled={resetLoading}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            {resetLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            Mot de passe oublié ?
          </button>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
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
      </div>
      {resetSent && (
        <div className="rounded-lg bg-success/10 border border-success/20 p-3 text-center">
          <p className="text-xs text-success font-medium">Email envoyé. Vérifiez votre boîte mail.</p>
        </div>
      )}
      <Button type="submit" className="h-11 w-full shadow-elegant" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("auth.signin.submit")}
      </Button>
    </form>
  );
}
