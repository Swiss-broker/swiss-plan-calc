import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { PublicLanguageSwitcher } from "@/components/common/PublicLanguageSwitcher";
import { t as translate } from "@/lib/i18n";

const authSearchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  plan: z.enum(["starter", "pro", "cabinet"]).optional(),
  session_id: z.string().optional(),
  confirmed: z.string().optional(),
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

const signupSchema = z.object({
  firstName: z.string().trim().min(1, "auth.error.first_required").max(80),
  lastName: z.string().trim().min(1, "auth.error.last_required").max(80),
  email: z.string().trim().email("auth.error.email_invalid").max(255),
  password: z.string().min(8, "auth.error.password_min").max(72),
});

const signinSchema = z.object({
  email: z.string().trim().email("auth.error.email_invalid"),
  password: z.string().min(1, "auth.error.password_required"),
});

type SignupValues = z.infer<typeof signupSchema>;
type SigninValues = z.infer<typeof signinSchema>;

function AuthPage() {
  const t = useT();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const selectedPlan = search.plan ?? "pro";
  const sessionId = search.session_id;
  const confirmed = search.confirmed;
  const [stripeEmail, setStripeEmail] = useState<string>("");

  useEffect(() => {
    if (!sessionId) return;
    supabase.functions.invoke("stripe-session", {
      body: { sessionId },
    }).then(({ data }) => {
      if (data?.email) setStripeEmail(data.email);
    });
  }, [sessionId]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: "/dashboard" });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (confirmed === "pending") {
    return (
      <div className="relative min-h-screen overflow-hidden bg-hero">
        <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
        <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-8">
          <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-elegant text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <span className="text-3xl">📧</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Vérifiez vos emails</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Un email de confirmation a été envoyé à votre adresse. Cliquez sur le lien dans cet email pour activer votre compte et accéder à SwissBroker Pro.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Pensez à vérifier vos spams si vous ne recevez pas l'email dans les prochaines minutes.
            </p>
            <div className="mt-6">
              <Link to="/auth" className="text-sm font-medium text-primary hover:underline">
                Retour à la connexion
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-hero">
      <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-4 py-8">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
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
              {mode === "signup" ? t("auth.signup.title") : t("auth.signin.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signup" ? t("auth.signup.subtitle") : t("auth.signin.subtitle")}
            </p>
          </div>

          <GoogleButton />

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("auth.divider.or")}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {mode === "signup" ? <SignupForm plan={selectedPlan} stripeEmail={stripeEmail} sessionId={sessionId} /> : <SigninForm />}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? (
              <>
                {t("auth.toggle.have_account")}{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="font-medium text-primary hover:underline"
                >
                  {t("auth.toggle.signin")}
                </button>
              </>
            ) : (
              <>
                {t("auth.toggle.no_account")}{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="font-medium text-primary hover:underline"
                >
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

function GoogleButton() {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const onGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/dashboard`,
    });
    if (result.error) {
      toast.error(t("auth.google.error"));
      setLoading(false);
      return;
    }
    if (result.redirected) return;
  };
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full"
      onClick={onGoogle}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
      )}
      {t("auth.google.continue")}
    </Button>
  );
}

function SignupForm({ plan, stripeEmail, sessionId }: { plan: string; stripeEmail: string; sessionId?: string }) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { firstName: "", lastName: "", email: stripeEmail, password: "" },
  });

  const onSubmit = async (values: SignupValues) => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { first_name: values.firstName, last_name: values.lastName },
      },
    });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("already")) {
        toast.error(t("auth.error.account_exists"));
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success(t("auth.success.signup"));
    // Appel Stripe Checkout
    try {
      const PRICE_IDS: Record<string, string> = {
        starter: import.meta.env.VITE_STRIPE_STARTER_MONTHLY ?? "",
        pro: import.meta.env.VITE_STRIPE_PRO_MONTHLY ?? "",
        cabinet: import.meta.env.VITE_STRIPE_CABINET_MONTHLY ?? "",
      };
      const priceId = PRICE_IDS[plan] ?? PRICE_IDS.pro;
      const { data: { session } } = await supabase.auth.getSession();
      const brokerId = session?.user?.id ?? "";
      const { data, error: fnError } = await supabase.functions.invoke("stripe-checkout", {
        body: { priceId, brokerId, brokerEmail: values.email },
      });
      if (fnError || !data?.url) throw new Error("Erreur Stripe");
      window.location.href = data.url;
    } catch {
      // Si Stripe échoue, on redirige quand même vers le dashboard
      navigate({ to: "/dashboard" });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">{t("auth.field.first_name")}</Label>
          <Input id="firstName" {...form.register("firstName")} />
          {form.formState.errors.firstName && (
            <p className="text-xs text-destructive">{t(form.formState.errors.firstName.message ?? "")}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">{t("auth.field.last_name")}</Label>
          <Input id="lastName" {...form.register("lastName")} />
          {form.formState.errors.lastName && (
            <p className="text-xs text-destructive">{t(form.formState.errors.lastName.message ?? "")}</p>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("auth.field.email_pro")}</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")}  />
        {stripeEmail && (
          <p className="text-[11px] text-muted-foreground">
            ⚠️ Utilisez obligatoirement l'email avec lequel vous avez payé. Si vous vous connectez via Google, assurez-vous que c'est le même email.
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t("auth.field.password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...form.register("password")}
        />
        {form.formState.errors.password && (
          <p className="text-xs text-destructive">{t(form.formState.errors.password.message ?? "")}</p>
        )}
      </div>
      <Button type="submit" className="h-11 w-full shadow-elegant" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("auth.signup.submit")}
      </Button>
    </form>
  );
}

function SigninForm() {
  const t = useT();
  const [loading, setLoading] = useState(false);
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("auth.field.email")}</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        {form.formState.errors.email && (
          <p className="text-xs text-destructive">{t(form.formState.errors.email.message ?? "")}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t("auth.field.password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...form.register("password")}
        />
        {form.formState.errors.password && (
          <p className="text-xs text-destructive">{t(form.formState.errors.password.message ?? "")}</p>
        )}
      </div>
      <Button type="submit" className="h-11 w-full shadow-elegant" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("auth.signin.submit")}
      </Button>
    </form>
  );
}
