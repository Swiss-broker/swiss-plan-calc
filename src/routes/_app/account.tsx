import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, User, Building2, CreditCard, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useEffect as useEffectConnect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { getSelectableCantons, isSelectableCanton, CANTON_BY_CODE } from "@/lib/swiss/cantons";
import { tCanton, t as translate } from "@/lib/i18n";

export const Route = createFileRoute("/_app/account")({
  head: () => ({ meta: [{ title: translate("account.head.title") }] }),
  component: AccountPage,
});

const TABS = [
  { id: "profil", label: "Profil", icon: User },
  { id: "cabinet", label: "Mon cabinet", icon: Building2 },
  { id: "abonnement", label: "Abonnement", icon: CreditCard },
  { id: "paiements", label: "Mes paiements", icon: CreditCard },
  { id: "pdf", label: "Rapports PDF", icon: FileText },
] as const;

type TabId = typeof TABS[number]["id"];

const PLAN_CONFIG: Record<string, { label: string; color: string; features: string[] }> = {
  trial: {
    label: "Essai gratuit (3 jours)",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    features: ["Accès complet Pro pendant 3 jours", "Carte bancaire enregistrée", "Aucun débit avant J+3"],
  },
  starter: {
    label: "Starter — 490 CHF/mois",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    features: ["10 clients max", "2 sociétés max", "Tous les calculateurs", "10 exports PDF/mois", "IA 10 conversations/jour"],
  },
  pro: {
    label: "Pro — 790 CHF/mois",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    features: ["20 clients max", "4 sociétés max", "Tous les calculateurs", "Exports PDF illimités", "IA illimitée", "Support prioritaire"],
  },
  cabinet: {
    label: "Cabinet — 1'290 CHF/mois",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    features: ["Clients illimités", "Sociétés illimitées", "Tous les calculateurs", "Exports PDF illimités", "IA illimitée", "Gestion multi-courtiers", "Support dédié"],
  },
  expired: {
    label: "Abonnement expiré",
    color: "bg-red-100 text-red-800 border-red-200",
    features: ["Accès restreint — renouvelez votre abonnement pour retrouver l'accès complet"],
  },
};

function AccountPage() {
  const t = useT();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("profil");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<string>("trial");
  const [sendingReset, setSendingReset] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectComplete, setConnectComplete] = useState(false);

  // Vérifier si le compte Connect est déjà configuré
  useEffectConnect(() => {
    if (!user) return;
    supabase
      .from("broker_connect_accounts")
      .select("onboarding_complete")
      .eq("broker_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.onboarding_complete) setConnectComplete(true);
      });
    // Détecter le retour du flux Stripe Connect
    const params = new URLSearchParams(window.location.search);
    if (params.get("connect") === "success") {
      supabase
        .from("broker_connect_accounts")
        .update({ onboarding_complete: true })
        .eq("broker_id", user.id)
        .then(() => setConnectComplete(true));
    }
  }, [user]);

  const onConnectBankAccount = async () => {
    if (!user) return;
    setConnectLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
        body: {
          brokerId: user.id,
          brokerEmail: user.email,
          returnUrl: `${window.location.origin}/account`,
        },
      });
      if (error || !data?.url) throw new Error("Erreur connexion compte");
      window.location.href = data.url;
    } catch {
      setConnectLoading(false);
    }
  };
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    brokerage_name: "",
    phone: "",
    default_canton: "",
    pdf_primary_color: "#0F4C81",
    pdf_accent_color: "#3B82F6",
    pdf_footer_note: "",
    logo_url: "" as string,
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name,last_name,brokerage_name,phone,default_canton,pdf_primary_color,pdf_accent_color,pdf_footer_note,logo_url,plan")
        .eq("id", user.id)
        .maybeSingle();
      if (error) toast.error(t("account.toast.load_error"));
      if (data) {
        setPlan(data.plan ?? "trial");
        setProfile({
          first_name: data.first_name ?? "",
          last_name: data.last_name ?? "",
          brokerage_name: data.brokerage_name ?? "",
          phone: data.phone ?? "",
          default_canton: data.default_canton ?? "",
          pdf_primary_color: data.pdf_primary_color ?? "#0F4C81",
          pdf_accent_color: data.pdf_accent_color ?? "#3B82F6",
          pdf_footer_note: data.pdf_footer_note ?? "",
          logo_url: data.logo_url ?? "",
        });
      }
      setLoading(false);
    })();
  }, [user, t]);

  const onSave = async (fields: Partial<typeof profile>) => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(fields).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(t("account.toast.save_error"));
      return;
    }
    toast.success(t("account.toast.save_success"));
  };

  const onResetPassword = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setSendingReset(false);
    toast.success("Email de réinitialisation envoyé");
  };

  const onUploadLogo = async (file: File) => {
    if (!user) return;
    const ALLOWED = ["image/png", "image/jpeg", "image/svg+xml"];
    if (!ALLOWED.includes(file.type)) { toast.error("Format non supporté (PNG, JPG ou SVG uniquement)."); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo trop lourd (max 2 Mo)."); return; }
    setUploadingLogo(true);
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${user.id}/logo.${ext}`;
    const { error: upErr } = await supabase.storage.from("broker-logos").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setUploadingLogo(false); toast.error("Échec de l'upload du logo"); return; }
    const { data: pub } = supabase.storage.from("broker-logos").getPublicUrl(path);
    const url = `${pub.publicUrl}?v=${Date.now()}`;
    await supabase.from("profiles").update({ logo_url: url }).eq("id", user.id);
    setProfile((p) => ({ ...p, logo_url: url }));
    setUploadingLogo(false);
    toast.success("Logo mis à jour");
  };

  const onRemoveLogo = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ logo_url: null }).eq("id", user.id);
    setProfile((p) => ({ ...p, logo_url: "" }));
    toast.success("Logo retiré");
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentPlan = PLAN_CONFIG[plan] ?? PLAN_CONFIG["trial"];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Mon profil</h1>
      <p className="mt-1 text-sm text-muted-foreground">Gérez vos informations, votre abonnement et vos préférences.</p>

      {/* Onglets horizontaux */}
      <div className="mt-6 flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenu onglet Profil */}
      {activeTab === "profil" && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">{t("form.first_name")}</Label>
              <Input id="first_name" value={profile.first_name} onChange={(e) => setProfile((p) => ({ ...p, first_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">{t("form.last_name")}</Label>
              <Input id="last_name" value={profile.last_name} onChange={(e) => setProfile((p) => ({ ...p, last_name: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled className="bg-muted text-muted-foreground" />
            <p className="text-xs text-muted-foreground">L'adresse email ne peut pas être modifiée.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">{t("form.phone")}</Label>
            <Input id="phone" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onResetPassword}
              disabled={sendingReset}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              {sendingReset && <Loader2 className="h-3 w-3 animate-spin" />}
              Réinitialiser mon mot de passe
            </button>
            <Button
              onClick={() => onSave({ first_name: profile.first_name.trim() || null, last_name: profile.last_name.trim() || null, phone: profile.phone.trim() || null } as Parameters<typeof onSave>[0])}
              disabled={saving}
              className="shadow-elegant"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </div>
      )}

      {/* Contenu onglet Mon cabinet */}
      {activeTab === "cabinet" && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="brokerage_name">{t("account.brokerage_name")}</Label>
            <Input id="brokerage_name" value={profile.brokerage_name} onChange={(e) => setProfile((p) => ({ ...p, brokerage_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="canton">{t("account.default_canton")}</Label>
            <select
              id="canton"
              value={profile.default_canton}
              onChange={(e) => setProfile((p) => ({ ...p, default_canton: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">{t("account.default_canton.none")}</option>
              {getSelectableCantons().map((c) => (
                <option key={c.code} value={c.code}>{c.code} · {tCanton(c.code)}</option>
              ))}
              {profile.default_canton && !isSelectableCanton(profile.default_canton) && (
                <option value={profile.default_canton}>
                  {profile.default_canton} · {tCanton(profile.default_canton) || CANTON_BY_CODE[profile.default_canton]?.name || profile.default_canton} {t("account.default_canton.out_of_scope")}
                </option>
              )}
            </select>
          </div>

          {/* Logo */}
          <div className="space-y-3 rounded-xl border border-dashed border-border bg-muted/30 p-4">
            <div>
              <h2 className="text-sm font-semibold">Logo du cabinet</h2>
              <p className="text-xs text-muted-foreground">PNG, JPG ou SVG, 2 Mo max. Affiché en haut à gauche de chaque PDF.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
                {profile.logo_url ? (
                  <img src={profile.logo_url} alt="Logo cabinet" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">Aucun logo</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
                  {uploadingLogo && <Loader2 className="h-3 w-3 animate-spin" />}
                  {profile.logo_url ? "Remplacer le logo" : "Téléverser un logo"}
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadLogo(f); e.target.value = ""; }}
                    disabled={uploadingLogo}
                  />
                </label>
                {profile.logo_url && (
                  <button type="button" onClick={onRemoveLogo} className="text-left text-xs text-destructive hover:underline">Retirer le logo</button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => onSave({ brokerage_name: profile.brokerage_name.trim() || null, default_canton: profile.default_canton || null } as Parameters<typeof onSave>[0])}
              disabled={saving}
              className="shadow-elegant"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </div>
      )}

      {/* Contenu onglet Abonnement */}
      {activeTab === "abonnement" && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card space-y-5">
          <div>
            <h2 className="text-base font-semibold mb-3">Plan actif</h2>
            <span className={`inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-semibold ${currentPlan.color}`}>
              {currentPlan.label}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">Inclus dans votre plan</h3>
            <ul className="space-y-2">
              {currentPlan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          {plan === "expired" && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
              <p className="text-sm text-destructive font-medium">Votre abonnement est expiré.</p>
              <a href="/" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
                Renouveler mon abonnement →
              </a>
            </div>
          )}
          {plan !== "expired" && (
            <div className="rounded-lg bg-muted/40 border border-border p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Gérer mon abonnement</p>
                <p className="text-xs text-muted-foreground mt-0.5">Annuler, voir vos factures, mettre à jour votre moyen de paiement.</p>
              </div>
              <ManageSubscriptionButton email={user?.email ?? ""} />
            </div>
          )}


        </div>
      )}

      {/* Contenu onglet Mes paiements */}
      {activeTab === "paiements" && (
        <div className="mt-6 space-y-5">
          {/* Section IBAN */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
            <h2 className="text-base font-semibold">Compte bancaire pour facturation</h2>
            <p className="text-xs text-muted-foreground">
              Connectez votre compte bancaire pour recevoir les paiements de vos clients directement. SwissBroker Pro retient 10% de commission sur chaque paiement, le reste est viré automatiquement sur votre compte.
            </p>
            {connectComplete ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-success font-medium">
                  <span>✅</span> Compte bancaire connecté
                </div>
                <button
                  type="button"
                  onClick={onConnectBankAccount}
                  disabled={connectLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  {connectLoading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
                  Modifier mon compte bancaire
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onConnectBankAccount}
                disabled={connectLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {connectLoading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                Connecter mon compte bancaire
              </button>
            )}
          </div>

          {/* Liste des paiements reçus */}
          <PaiementsHistory userId={user?.id ?? ""} />
        </div>
      )}

      {/* Contenu onglet Rapports PDF */}
      {activeTab === "pdf" && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card space-y-5">
          <div>
            <h2 className="text-sm font-semibold">{t("account.pdf.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("account.pdf.subtitle")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pdf_primary_color">{t("account.pdf.primary_color")}</Label>
              <div className="flex items-center gap-2">
                <input id="pdf_primary_color" type="color" value={profile.pdf_primary_color}
                  onChange={(e) => setProfile((p) => ({ ...p, pdf_primary_color: e.target.value }))}
                  className="h-9 w-14 cursor-pointer rounded border border-input bg-transparent"
                />
                <Input value={profile.pdf_primary_color}
                  onChange={(e) => setProfile((p) => ({ ...p, pdf_primary_color: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdf_accent_color">{t("account.pdf.accent_color")}</Label>
              <div className="flex items-center gap-2">
                <input id="pdf_accent_color" type="color" value={profile.pdf_accent_color}
                  onChange={(e) => setProfile((p) => ({ ...p, pdf_accent_color: e.target.value }))}
                  className="h-9 w-14 cursor-pointer rounded border border-input bg-transparent"
                />
                <Input value={profile.pdf_accent_color}
                  onChange={(e) => setProfile((p) => ({ ...p, pdf_accent_color: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdf_footer_note">{t("account.pdf.footer_note")}</Label>
            <Input id="pdf_footer_note" value={profile.pdf_footer_note}
              onChange={(e) => setProfile((p) => ({ ...p, pdf_footer_note: e.target.value }))}
              placeholder={t("account.pdf.footer_note.placeholder")}
            />
            <p className="text-xs text-muted-foreground">{t("account.pdf.footer_note.help")}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t("account.pdf.preview")}</Label>
            <div className="overflow-hidden rounded-lg border border-border" style={{ background: profile.pdf_primary_color }}>
              <div className="px-4 py-3 text-white">
                <div className="text-sm font-bold">
                  {profile.brokerage_name || `${profile.first_name} ${profile.last_name}`.trim() || t("account.pdf.preview.cabinet_placeholder")}
                </div>
                <div className="text-[10px] opacity-90">
                  {[`${profile.first_name} ${profile.last_name}`.trim(), user?.email, profile.phone].filter(Boolean).join(" · ")}
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => onSave({ pdf_primary_color: profile.pdf_primary_color, pdf_accent_color: profile.pdf_accent_color, pdf_footer_note: profile.pdf_footer_note.trim() || null } as Parameters<typeof onSave>[0])}
              disabled={saving}
              className="shadow-elegant"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ManageSubscriptionButton({ email }: { email: string }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-portal", {
        body: { brokerEmail: email },
      });
      if (error || !data?.url) throw new Error("Erreur portail");
      window.location.href = data.url;
    } catch {
      toast.error("Impossible d'accéder au portail. Contactez le support.");
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors shrink-0"
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      Gérer →
    </button>
  );
}

function PaiementsHistory({ userId }: { userId: string }) {
  const [invoices, setInvoices] = useState<Array<{
    id: string;
    amount_chf: number;
    status: string;
    stripe_payment_link: string | null;
    created_at: string;
    client_id: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("rdv_invoices")
      .select("id,amount_chf,status,stripe_payment_link,created_at,client_id")
      .eq("broker_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setInvoices((data as typeof invoices) ?? []);
        setLoading(false);
      });
  }, [userId]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
      <h2 className="text-base font-semibold">Historique des paiements</h2>
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun paiement reçu pour l'instant. Les paiements de vos clients apparaîtront ici.</p>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">{(inv.amount_chf / 100).toLocaleString("fr-CH", { minimumFractionDigits: 2 })} CHF</p>
                <p className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString("fr-CH")}</p>
              </div>
              <div className="flex items-center gap-2">
                {inv.status === "paid" ? (
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Payé</span>
                ) : inv.status === "pending" ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">En attente</span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{inv.status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
