// Composeur d'e-mail à partir d'un modèle : le courtier choisit un modèle,
// voit le texte déjà rempli avec les infos du client/RDV/documents, peut
// tout modifier librement, puis envoie (ou enregistre sa version comme son
// modèle personnalisé pour la prochaine fois). Rien ne part jamais sans ce
// clic explicite sur "Envoyer".
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail } from "lucide-react";
import { supabase as _supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  EMAIL_TEMPLATES,
  EMAIL_TEMPLATES_BY_KEY,
  TEMPLATE_VARIABLES,
  renderTemplate,
  type TemplateKey,
} from "@/lib/emails/templates";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/lib/documents/categories";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

export function EmailComposerDialog({
  clientId,
  open,
  onOpenChange,
  defaultTemplateKey,
  categoriesOverride,
  onSent,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTemplateKey?: TemplateKey;
  // Restreint {{documents_manquants}} à cette liste précise (ex. les
  // documents cochés par le courtier) au lieu de tous les documents encore
  // en attente pour le client : sans ça, chaque demande ponctuelle renvoie
  // la liste complète, même pour un seul document.
  categoriesOverride?: DocumentCategory[];
  onSent?: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [templateKey, setTemplateKey] = useState<TemplateKey>(defaultTemplateKey ?? "demande_documents");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  // Tout ce qu'il faut pour résoudre les variables : client, profil
  // courtier, prochain rendez-vous, documents en attente, lien de dépôt
  // actif, et les éventuelles personnalisations déjà enregistrées.
  const contextQuery = useQuery({
    queryKey: ["email-compose-context", clientId, user?.id],
    enabled: open && !!user,
    queryFn: async () => {
      const [clientRes, profileRes, apptRes, requestsRes, linksRes, templatesRes] = await Promise.all([
        supabase.from("clients").select("first_name,last_name,email").eq("id", clientId).maybeSingle(),
        supabase
          .from("profiles")
          .select("first_name,last_name,brokerage_name,email_signature")
          .eq("id", user!.id)
          .maybeSingle(),
        supabase
          .from("appointments")
          .select("starts_at")
          .eq("client_id", clientId)
          .neq("status", "annule")
          .gte("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase.from("client_document_requests").select("category,status").eq("client_id", clientId),
        supabase
          .from("client_document_links")
          .select("token,expires_at,revoked,max_uploads,upload_count")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
        supabase.from("email_templates").select("template_key,subject,body").eq("broker_id", user!.id),
      ]);
      return {
        client: clientRes.data as { first_name: string; last_name: string; email: string | null } | null,
        profile: profileRes.data as
          | { first_name: string | null; last_name: string | null; brokerage_name: string | null; email_signature: string | null }
          | null,
        nextAppointment: apptRes.data as { starts_at: string } | null,
        requests: (requestsRes.data ?? []) as { category: string; status: string }[],
        links: (linksRes.data ?? []) as {
          token: string;
          expires_at: string;
          revoked: boolean;
          max_uploads: number;
          upload_count: number;
        }[],
        customTemplates: (templatesRes.data ?? []) as { template_key: string; subject: string; body: string }[],
      };
    },
  });

  const vars = useMemo(() => {
    const data = contextQuery.data;
    if (!data) return {};
    const brokerName = [data.profile?.first_name, data.profile?.last_name].filter(Boolean).join(" ").trim();
    const activeLink = data.links.find(
      (l) => !l.revoked && new Date(l.expires_at) > new Date() && l.upload_count < l.max_uploads,
    );
    const missing =
      categoriesOverride && categoriesOverride.length > 0
        ? DOCUMENT_CATEGORIES.filter((cat) => categoriesOverride.includes(cat.value))
        : DOCUMENT_CATEGORIES.filter((cat) => {
            const req = data.requests.find((r) => r.category === cat.value);
            return !req || (req.status !== "recu" && req.status !== "verifie");
          });
    const start = data.nextAppointment ? new Date(data.nextAppointment.starts_at) : null;
    return {
      prenom: data.client?.first_name ?? "",
      nom: data.client?.last_name ?? "",
      nom_courtier: brokerName || undefined,
      cabinet: data.profile?.brokerage_name ?? "",
      date_rdv: start ? start.toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" }) : "",
      heure_rdv: start ? start.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" }) : "",
      documents_manquants: missing.length ? missing.map((c) => `- ${c.label}`).join("\n") : "",
      lien_depot: activeLink ? `${window.location.origin}/client-upload/${activeLink.token}` : "",
      signature: data.profile?.email_signature || brokerName || "",
    } as Record<string, string>;
  }, [contextQuery.data, categoriesOverride]);

  // À chaque changement de modèle (ou une fois le contexte chargé), on
  // repart du modèle personnalisé du courtier s'il existe, sinon du
  // défaut, avec les variables résolues. Le courtier peut ensuite tout
  // réécrire librement : ce n'est qu'un point de départ.
  useEffect(() => {
    if (!open || !contextQuery.data) return;
    const custom = contextQuery.data.customTemplates.find((t) => t.template_key === templateKey);
    const base = custom ?? EMAIL_TEMPLATES_BY_KEY[templateKey];
    setSubject(renderTemplate(base.subject, vars));
    setBody(renderTemplate(base.body, vars));
    setSaveAsDefault(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateKey, contextQuery.data]);

  const send = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-client-email", {
        body: { clientId, subject, body, templateKey },
      });
      if (error || !data?.sent) {
        let message = error?.message ?? "Erreur lors de l'envoi.";
        const ctx = (error as unknown as { context?: Response })?.context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const errBody = await ctx.json();
            if (errBody?.error) message = String(errBody.error);
          } catch {
            // corps non exploitable, on garde le message générique
          }
        }
        throw new Error(message);
      }
      if (saveAsDefault) {
        await supabase.from("email_templates").upsert(
          { broker_id: user!.id, template_key: templateKey, subject, body },
          { onConflict: "broker_id,template_key" },
        );
      }
    },
    onSuccess: () => {
      toast.success("E-mail envoyé.");
      qc.invalidateQueries({ queryKey: ["client-email-log", clientId] });
      qc.invalidateQueries({ queryKey: ["email-compose-context"] });
      onOpenChange(false);
      onSent?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clientHasEmail = !!contextQuery.data?.client?.email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> Composer un e-mail
          </DialogTitle>
          <DialogDescription>
            Choisissez un modèle, relisez et modifiez le texte, puis envoyez. Rien n'est envoyé automatiquement.
          </DialogDescription>
        </DialogHeader>

        {contextQuery.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <div className="space-y-4">
            {!clientHasEmail && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
                Ce client n'a pas d'adresse e-mail enregistrée. Ajoutez-en une dans sa fiche pour pouvoir lui écrire.
              </p>
            )}

            <div className="space-y-1.5">
              <Label>Modèle</Label>
              <Select value={templateKey} onValueChange={(v) => setTemplateKey(v as TemplateKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TEMPLATES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-subject">Objet</Label>
              <Input id="email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-body">Message</Label>
              <Textarea
                id="email-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="font-sans"
              />
              <p className="text-xs text-muted-foreground">
                Variables disponibles :{" "}
                {TEMPLATE_VARIABLES.map((v) => v.token).join(" · ")}
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={saveAsDefault}
                onChange={(e) => setSaveAsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Enregistrer cette version comme mon modèle « {EMAIL_TEMPLATES_BY_KEY[templateKey].label} »
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={send.isPending || contextQuery.isLoading || !clientHasEmail}
            onClick={() => send.mutate()}
          >
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
