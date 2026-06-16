import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, AlertCircle } from "lucide-react";
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

function AuthPage() {
  const t = useT();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const selectedPlan = search.plan ?? "pro";

  useEffect(() => {
    // Ne pas rediriger si on est sur la page de confirmation (flux post-email)
    if (window.location.pathname.startsWith("/auth/confirm")) return;
    if (!isLoading && isAuthenticated) {
      navigate({ to: "/dashboard" });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Page confirmation email envoyé
  if (emailSent) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-hero">
        <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
        <div className="relative mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-8">
          <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-elegant">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <Mail className="h-8 w-8 text-success" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Vérifiez vos emails</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Un email de confirmation a été envoyé à
              </p>
              <p className="mt-1 font-medium text-foreground">{emailSent}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                Cliquez sur le lien dans cet email pour continuer vers le paiement et activer votre accès SwissBroker Pro.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Vous ne trouvez pas l'email ?
              </p>

              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-lg">📮</span>
                  <div>
                    <p className="text-sm font-medium">Outlook, Hotmail ou Live</p>
                    <p className="text-xs text-muted-foreground">
                      Vérifiez le dossier <strong>Courrier indésirable</strong>. Cliquez sur l'email puis sur <strong>"Pas indésirable"</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-lg">📱</span>
                  <div>
                    <p className="text-sm font-medium">Application Mail iPhone ou iPad</p>
                    <p className="text-xs text-muted-foreground">
                      Vérifiez le dossier <strong>Indésirables</strong>. Si absent, connectez-vous directement sur <strong>outlook.com</strong> ou <strong>gmail.com</strong> depuis un navigateur.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-lg">✉️</span>
                  <div>
                    <p className="text-sm font-medium">Gmail</p>
                    <p className="text-xs text-muted-foreground">
                      Vérifiez l'onglet <strong>Promotions</strong> ou le dossier <strong>Spam</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-lg bg-primary/5 border border-primary/20 p-3 text-center">
              <p className="text-xs text-muted-foreground">
                Ajoutez <strong>noreply@swissbrokerpro.ch</strong> à vos contacts pour ne plus manquer nos emails.
              </p>
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setEmailSent(null)}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Retour
              </button>
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

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("auth.divider.or")}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {mode === "signup" ? (
            <SignupForm plan={selectedPlan} onEmailSent={setEmailSent} />
          ) : (
            <SigninForm />
          )}

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

function SignupForm({ plan, onEmailSent }: { plan: string; onEmailSent: (email: string) => void }) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "" },
  });

  const onSubmit = async (values: SignupValues) => {
    setLoading(true);

    // emailRedirectTo pointe vers la page de checkout Stripe
    const redirectTo = `${window.location.origin}/auth/confirm?plan=${plan}&email=${encodeURIComponent(values.email)}`;

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: redirectTo,
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

    // Redirige vers la page de saisie du code OTP
    window.location.href = `/auth/confirm?plan=${plan}&email=${encodeURIComponent(values.email)}`;
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
