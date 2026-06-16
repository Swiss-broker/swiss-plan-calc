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
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { PublicLanguageSwitcher } from "@/components/common/PublicLanguageSwitcher";
import { t as translate } from "@/lib/i18n";

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

const PRICE_IDS: Record<string, string> = {
  starter: import.meta.env.VITE_STRIPE_STARTER_MONTHLY ?? "",
  pro: import.meta.env.VITE_STRIPE_PRO_MONTHLY ?? "",
  cabinet: import.meta.env.VITE_STRIPE_CABINET_MONTHLY ?? "",
};

function AuthPage() {
  const t = useT();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const selectedPlan = search.plan ?? "pro";

  const [otpState, setOtpState] = useState<{ email: string; plan: string } | null>(null);
  const [otpToken, setOtpToken] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  useEffect(() => {
    if (otpState) return;
    if (!isLoading && isAuthenticated) {
      navigate({ to: "/dashboard" });
    }
  }, [isAuthenticated, isLoading, navigate, otpState]);

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpState) return;
    setOtpLoading(true);
    setOtpError(null);

    const { data, error: otpError } = await supabase.auth.verifyOtp({
      email: otpState.email,
      token: otpToken,
      type: "signup",
    });

    if (otpError || !data.session) {
      setOtpLoading(false);
      setOtpError("Code incorrect ou expiré. Vérifiez le code reçu par email.");
      return;
    }

    const priceId = PRICE_IDS[otpState.plan];
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
          plan: otpState.plan,
        },
      });
      if (fnError || !stripeData?.url) throw new Error("Erreur Stripe");
      window.location.href = stripeData.url;
    } catch {
      setOtpError("Erreur lors de la redirection vers le paiement. Contactez le support.");
      setOtpLoading(false);
    }
  };

  if (otpState) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-hero flex items-center justify-center px-4">
        <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
        <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <span className="text-3xl">📧</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Vérifiez vos emails</h1>
            <p className="mt-2 text-sm text-muted-foreground">Un code à 6 chiffres a été envoyé à</p>
            <p className="font-medium text-foreground">{otpState.email}</p>
          </div>

          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="otp">Code de confirmation</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="text-center text-2xl tracking-widest font-bold"
                autoFocus
                required
              />
            </div>

            {otpError && <p className="text-sm text-destructive text-center">{otpError}</p>}

            <Button type="submit" className="h-11 w-full shadow-elegant" disabled={otpLoading || otpToken.length < 6}>
              {otpLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmer et accéder au paiement
            </Button>
          </form>

          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Vérifiez vos <strong>courriers indésirables</strong> si vous ne trouvez pas l'email.<br />
              Expéditeur : <strong>noreply@swissbrokerpro.ch</strong>
            </p>
          </div>

          <div className="mt-4 text-center">
            <button type="button" onClick={() => setOtpState(null)} className="text-xs text-muted-foreground hover:text-foreground underline">
              Retour
            </button>
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
              {mode === "signup" ? t("auth.signup.title") : t("auth.signin.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signup" ? t("auth.signup.subtitle") : t("auth.signin.subtitle")}
            </p>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("auth.divider.or")}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {mode === "signup" ? (
            <SignupForm plan={selectedPlan} onOtpRequired={setOtpState} />
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

function SignupForm({ plan, onOtpRequired }: { plan: string; onOtpRequired: (state: { email: string; plan: string }) => void }) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "" },
  });

  const onSubmit = async (values: SignupValues) => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
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
    onOtpRequired({ email: values.email, plan });
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
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t("auth.field.password")}</Label>
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
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
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t("auth.field.password")}</Label>
        <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
      </div>
      <Button type="submit" className="h-11 w-full shadow-elegant" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("auth.signin.submit")}
      </Button>
    </form>
  );
}
