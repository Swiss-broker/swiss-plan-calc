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
import { tCanton } from "@/lib/i18n";

export const Route = createFileRoute("/_app/account")({
  head: () => ({ meta: [{ title: "Mon profil · SwissBroker Pro" }] }),
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
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name,last_name,brokerage_name,phone,default_canton")
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
