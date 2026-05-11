import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { getSelectableCantons, isSelectableCanton, CANTON_BY_CODE } from "@/lib/swiss/cantons";
import { tCanton, t as translate } from "@/lib/i18n";

export const Route = createFileRoute("/_app/account")({
  head: () => ({ meta: [{ title: translate("account.head.title") }] }),
  component: AccountPage,
});

function AccountPage() {
  const t = useT();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        .select(
          "first_name,last_name,brokerage_name,phone,default_canton,pdf_primary_color,pdf_accent_color,pdf_footer_note,logo_url",
        )
        .eq("id", user.id)
        .maybeSingle();
      if (error) toast.error(t("account.toast.load_error"));
      if (data) {
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

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: profile.first_name.trim() || null,
        last_name: profile.last_name.trim() || null,
        brokerage_name: profile.brokerage_name.trim() || null,
        phone: profile.phone.trim() || null,
        default_canton: profile.default_canton || null,
        pdf_primary_color: profile.pdf_primary_color || "#0F4C81",
        pdf_accent_color: profile.pdf_accent_color || "#3B82F6",
        pdf_footer_note: profile.pdf_footer_note.trim() || null,
        logo_url: profile.logo_url || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(t("account.toast.save_error"));
      return;
    }
    toast.success(t("account.toast.save_success"));
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{t("account.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("account.subtitle")}</p>

      <form
        onSubmit={onSave}
        className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-card"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="first_name"
            label={t("form.first_name")}
            value={profile.first_name}
            onChange={(v) => setProfile((p) => ({ ...p, first_name: v }))}
          />
          <Field
            id="last_name"
            label={t("form.last_name")}
            value={profile.last_name}
            onChange={(v) => setProfile((p) => ({ ...p, last_name: v }))}
          />
        </div>
        <Field
          id="brokerage_name"
          label={t("account.brokerage_name")}
          value={profile.brokerage_name}
          onChange={(v) => setProfile((p) => ({ ...p, brokerage_name: v }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="phone"
            label={t("form.phone")}
            value={profile.phone}
            onChange={(v) => setProfile((p) => ({ ...p, phone: v }))}
          />
          <div className="space-y-1.5">
            <Label htmlFor="canton">{t("account.default_canton")}</Label>
            <select
              id="canton"
              value={profile.default_canton}
              onChange={(e) =>
                setProfile((p) => ({ ...p, default_canton: e.target.value }))
              }
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">{t("account.default_canton.none")}</option>
              {getSelectableCantons().map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {tCanton(c.code)}
                </option>
              ))}
              {profile.default_canton &&
                !isSelectableCanton(profile.default_canton) && (
                  <option value={profile.default_canton}>
                    {profile.default_canton} ·{" "}
                    {tCanton(profile.default_canton) ||
                      CANTON_BY_CODE[profile.default_canton]?.name ||
                      profile.default_canton}{" "}
                    {t("account.default_canton.out_of_scope")}
                  </option>
                )}
            </select>
            {profile.default_canton &&
              !isSelectableCanton(profile.default_canton) && (
                <p className="text-xs text-warning">
                  {t("account.default_canton.warning")}
                </p>
              )}
          </div>
        </div>

        {/* === Personnalisation des rapports PDF === */}
        <div className="space-y-4 rounded-xl border border-dashed border-border bg-muted/30 p-4">
          <div>
            <h2 className="text-sm font-semibold">{t("account.pdf.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("account.pdf.subtitle")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pdf_primary_color">{t("account.pdf.primary_color")}</Label>
              <div className="flex items-center gap-2">
                <input
                  id="pdf_primary_color"
                  type="color"
                  value={profile.pdf_primary_color}
                  onChange={(e) => setProfile((p) => ({ ...p, pdf_primary_color: e.target.value }))}
                  className="h-9 w-14 cursor-pointer rounded border border-input bg-transparent"
                />
                <Input
                  value={profile.pdf_primary_color}
                  onChange={(e) => setProfile((p) => ({ ...p, pdf_primary_color: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdf_accent_color">{t("account.pdf.accent_color")}</Label>
              <div className="flex items-center gap-2">
                <input
                  id="pdf_accent_color"
                  type="color"
                  value={profile.pdf_accent_color}
                  onChange={(e) => setProfile((p) => ({ ...p, pdf_accent_color: e.target.value }))}
                  className="h-9 w-14 cursor-pointer rounded border border-input bg-transparent"
                />
                <Input
                  value={profile.pdf_accent_color}
                  onChange={(e) => setProfile((p) => ({ ...p, pdf_accent_color: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdf_footer_note">{t("account.pdf.footer_note")}</Label>
            <Input
              id="pdf_footer_note"
              value={profile.pdf_footer_note}
              onChange={(e) => setProfile((p) => ({ ...p, pdf_footer_note: e.target.value }))}
              placeholder={t("account.pdf.footer_note.placeholder")}
            />
            <p className="text-xs text-muted-foreground">{t("account.pdf.footer_note.help")}</p>
          </div>

          {/* Aperçu live du header PDF */}
          <div className="space-y-1.5">
            <Label>{t("account.pdf.preview")}</Label>
            <div
              className="overflow-hidden rounded-lg border border-border"
              style={{ background: profile.pdf_primary_color }}
            >
              <div className="px-4 py-3 text-white">
                <div className="text-sm font-bold">
                  {profile.brokerage_name || `${profile.first_name} ${profile.last_name}`.trim() || t("account.pdf.preview.cabinet_placeholder")}
                </div>
                <div className="text-[10px] opacity-90">
                  {[
                    `${profile.first_name} ${profile.last_name}`.trim(),
                    user?.email,
                    profile.phone,
                  ].filter(Boolean).join(" · ")}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="shadow-elegant">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("account.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
