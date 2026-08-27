// Onglet "E-mails" de la fiche client : déclenche le composeur de modèles
// et affiche l'historique des e-mails envoyés (traçabilité simple, pas de
// contenu stocké au-delà de l'objet).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Mail, Send } from "lucide-react";
import { supabase as _supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmailComposerDialog } from "@/components/clients/EmailComposerDialog";
import { EMAIL_TEMPLATES_BY_KEY, type TemplateKey } from "@/lib/emails/templates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

type LogRow = { id: string; template_key: string | null; subject: string; sent_at: string };

export function EmailsTab({ clientId }: { clientId: string }) {
  const [composerOpen, setComposerOpen] = useState(false);

  const logQuery = useQuery({
    queryKey: ["client-email-log", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_email_log")
        .select("id,template_key,subject,sent_at")
        .eq("client_id", clientId)
        .order("sent_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as LogRow[];
    },
  });

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Mail className="h-5 w-5 text-primary" />
            E-mails
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Composez un e-mail à partir d'un modèle, relisez-le, puis envoyez-le à ce client.
          </p>
        </div>
        <Button onClick={() => setComposerOpen(true)}>
          <Send className="h-4 w-4" /> Nouveau message
        </Button>
      </div>

      <div className="mt-4">
        {logQuery.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : !logQuery.data || logQuery.data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Aucun e-mail envoyé à ce client pour l'instant.
          </div>
        ) : (
          <ul className="space-y-2">
            {logQuery.data.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{row.subject}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.template_key && EMAIL_TEMPLATES_BY_KEY[row.template_key as TemplateKey]
                      ? EMAIL_TEMPLATES_BY_KEY[row.template_key as TemplateKey].label
                      : "Message personnalisé"}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(row.sent_at).toLocaleString("fr-CH", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <EmailComposerDialog
        clientId={clientId}
        open={composerOpen}
        onOpenChange={setComposerOpen}
      />
    </Card>
  );
}
