import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CANTONS } from "@/lib/swiss/cantons";

export const Route = createFileRoute("/_app/account")({
  head: () => ({ meta: [{ title: "Mon profil — SwissBroker Pro" }] }),
  component: AccountPage,
});

function AccountPage() {
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
      if (error) toast.error("Impossible de charger votre profil");
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
  }, [user]);

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
      toast.error("Échec de l'enregistrement");
      return;
    }
    toast.success("Profil mis à jour");
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
      <h1 className="text-3xl font-bold tracking-tight">Mon profil</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ces informations apparaissent sur les rapports PDF générés pour vos clients.
      </p>

      <form
        onSubmit={onSave}
        className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-card"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Prénom"
            value={profile.first_name}
            onChange={(v) => setProfile((p) => ({ ...p, first_name: v }))}
          />
          <Field
            label="Nom"
            value={profile.last_name}
            onChange={(v) => setProfile((p) => ({ ...p, last_name: v }))}
          />
        </div>
        <Field
          label="Nom du cabinet"
          value={profile.brokerage_name}
          onChange={(v) => setProfile((p) => ({ ...p, brokerage_name: v }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Téléphone"
            value={profile.phone}
            onChange={(v) => setProfile((p) => ({ ...p, phone: v }))}
          />
          <div className="space-y-1.5">
            <Label htmlFor="canton">Canton par défaut</Label>
            <select
              id="canton"
              value={profile.default_canton}
              onChange={(e) =>
                setProfile((p) => ({ ...p, default_canton: e.target.value }))
              }
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— aucun —</option>
              {CANTONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="shadow-elegant">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
