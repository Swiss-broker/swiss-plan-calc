// Gestion des modèles d'e-mails du courtier : les 10 modèles par défaut
// sont listés avec leur état (par défaut ou personnalisé), modifiables
// individuellement et réinitialisables. Ne réutilise le contenu qu'au
// moment de composer un e-mail (voir EmailComposerDialog) ; rien n'est
// envoyé depuis cette page.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, RotateCcw } from "lucide-react";
import { supabase as _supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { EMAIL_TEMPLATES, TEMPLATE_VARIABLES, type TemplateKey } from "@/lib/emails/templates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

type OverrideRow = { template_key: string; subject: string; body: string };

export function EmailTemplatesSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<TemplateKey | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [signature, setSignature] = useState("");
  const [signatureLoaded, setSignatureLoaded] = useState(false);

  const overridesQuery = useQuery({
    queryKey: ["email-templates-overrides", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("template_key,subject,body")
        .eq("broker_id", user!.id);
      if (error) throw error;
      return (data || []) as OverrideRow[];
    },
  });

  const signatureQuery = useQuery({
    queryKey: ["profile-email-signature", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("email_signature")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.email_signature as string | null) ?? "";
    },
  });

  useEffect(() => {
    if (signatureQuery.data !== undefined && !signatureLoaded) {
      setSignature(signatureQuery.data ?? "");
      setSignatureLoaded(true);
    }
  }, [signatureQuery.data, signatureLoaded]);

  const overrideByKey = new Map((overridesQuery.data ?? []).map((r) => [r.template_key, r]));

  const openEdit = (key: TemplateKey) => {
    const override = overrideByKey.get(key);
    const base = EMAIL_TEMPLATES.find((t) => t.key === key)!;
    setSubject(override?.subject ?? base.subject);
    setBody(override?.body ?? base.body);
    setEditing(key);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("email_templates")
        .upsert({ broker_id: user!.id, template_key: editing, subject, body }, { onConflict: "broker_id,template_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates-overrides", user?.id] });
      toast.success("Modèle enregistré.");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: async (key: TemplateKey) => {
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("broker_id", user!.id)
        .eq("template_key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates-overrides", user?.id] });
      toast.success("Modèle réinitialisé.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSignature = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ email_signature: signature.trim() || null })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Signature enregistrée."),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold">Signature</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Utilisée pour la variable {"{{signature}}"} dans vos modèles. Laissez vide pour utiliser simplement votre nom.
        </p>
        <Textarea
          className="mt-3"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          rows={3}
          placeholder={"Ex. : Jean Dupont\nCourtier en prévoyance\nCabinet Dupont Conseil"}
        />
        <div className="mt-3 flex justify-end">
          <Button size="sm" disabled={saveSignature.isPending} onClick={() => saveSignature.mutate()}>
            {saveSignature.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold">Modèles d'e-mails</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Personnalisez librement chaque modèle. Vos modifications sont réutilisées à chaque envoi depuis une fiche
          client, sans jamais rien envoyer automatiquement.
        </p>

        {overridesQuery.isLoading ? (
          <Loader2 className="mt-4 h-4 w-4 animate-spin" />
        ) : (
          <ul className="mt-4 space-y-2">
            {EMAIL_TEMPLATES.map((t) => {
              const isCustom = overrideByKey.has(t.key);
              return (
                <li
                  key={t.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t.label}</span>
                    {isCustom && (
                      <Badge variant="outline" className="h-5 text-[10px]">
                        Personnalisé
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isCustom && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        disabled={reset.isPending}
                        onClick={() => reset.mutate(t.key)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEdit(t.key)}>
                      <Pencil className="h-3.5 w-3.5" /> Modifier
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing && EMAIL_TEMPLATES.find((t) => t.key === editing)?.label}
            </DialogTitle>
            <DialogDescription>
              Les variables comme {"{{prenom}}"} sont remplacées automatiquement à l'envoi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-subject">Objet</Label>
              <Input id="tpl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-body">Message</Label>
              <Textarea id="tpl-body" value={body} onChange={(e) => setBody(e.target.value)} rows={12} />
              <p className="text-xs text-muted-foreground">
                Variables : {TEMPLATE_VARIABLES.map((v) => v.token).join(" · ")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
