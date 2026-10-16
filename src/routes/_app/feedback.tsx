import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WikiHelpLink } from "@/components/wiki/WikiHelpLink";

type Message = {
  id: string;
  feedback_id: string;
  sender: "broker" | "admin";
  sender_name: string;
  content: string;
  created_at: string;
};

type FeedbackRow = {
  id: string;
  category: "bug" | "suggestion" | "calculation" | "ux" | "other";
  status: "new" | "in_review" | "planned" | "resolved" | "dismissed";
  subject: string;
  message: string;
  page_path: string | null;
  rating: number | null;
  created_at: string;
  messages: Message[];
};

const CATEGORY_LABEL: Record<FeedbackRow["category"], string> = {
  bug: "Bug",
  suggestion: "Suggestion",
  calculation: "Calcul",
  ux: "UX",
  other: "Autre",
};

const STATUS_LABEL: Record<FeedbackRow["status"], string> = {
  new: "Nouveau",
  in_review: "En cours de traitement",
  planned: "Planifié",
  resolved: "Résolu",
  dismissed: "Écarté",
};

const STATUS_VARIANT: Record<FeedbackRow["status"], "default" | "secondary" | "outline"> = {
  new: "default",
  in_review: "secondary",
  planned: "secondary",
  resolved: "outline",
  dismissed: "outline",
};

export const Route = createFileRoute("/_app/feedback")({
  component: FeedbackPage,
});

function FeedbackPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadFeedback();
  }, [user]);

  async function loadFeedback() {
    if (!user) return;
    const { data, error } = await supabase
      .from("user_feedback")
      .select("id,category,status,subject,message,page_path,rating,created_at")
      .eq("broker_id", user.id)
      .order("created_at", { ascending: false });

    if (error || !data) return;

    const feedbackIds = data.map((f) => f.id);
    const { data: msgs } = await (supabase as any)
      .from("feedback_messages")
      .select("*")
      .in("feedback_id", feedbackIds)
      .order("created_at", { ascending: true });

    const byFeedback: Record<string, Message[]> = {};
    (msgs ?? []).forEach((m: Message) => {
      if (!byFeedback[m.feedback_id]) byFeedback[m.feedback_id] = [];
      byFeedback[m.feedback_id].push(m);
    });

    setRows(data.map((f) => ({ ...f, messages: byFeedback[f.id] ?? [] })) as FeedbackRow[]);
  }

  async function sendReply(feedbackId: string) {
    if (!replyText.trim() || !user) return;
    setSending(true);
    const { data, error } = await (supabase as any)
      .from("feedback_messages")
      .insert({
        feedback_id: feedbackId,
        sender: "broker",
        sender_name: user.user_metadata?.first_name || user.email,
        content: replyText.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setRows((prev) =>
        prev
          ? prev.map((r) => (r.id === feedbackId ? { ...r, messages: [...r.messages, data] } : r))
          : prev
      );
      setReplyText("");
    }
    setSending(false);
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mes feedbacks</h1>
            <p className="text-sm text-muted-foreground">
              Historique des retours envoyés à l'équipe SwissBroker.
            </p>
          </div>
        </div>
        <WikiHelpLink article="feedback" />
      </div>

      {rows === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Aucun feedback pour le moment. Utilisez le bouton Feedback en bas au centre.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const isExpanded = expandedId === r.id;
            return (
              <Card key={r.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base">{r.subject}</CardTitle>
                      <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{CATEGORY_LABEL[r.category]}</Badge>
                        <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                        {r.rating != null && <span className="text-xs">Note : {r.rating}/5</span>}
                        <span className="text-xs">{new Date(r.created_at).toLocaleString("fr-CH")}</span>
                        {r.messages.length > 0 && (
                          <span className="text-xs">
                            {r.messages.length} message{r.messages.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="whitespace-pre-wrap text-sm text-foreground/90">{r.message}</p>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  >
                    {isExpanded ? "Fermer la conversation" : r.messages.length > 0 ? "Voir la conversation" : "Répondre"}
                  </Button>

                  {isExpanded && (
                    <div className="space-y-3">
                      <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
                        {r.messages.length === 0 ? (
                          <p className="py-4 text-center text-xs text-muted-foreground">
                            Aucun message pour l'instant.
                          </p>
                        ) : (
                          r.messages.map((m) => (
                            <div
                              key={m.id}
                              className={`flex flex-col ${m.sender === "broker" ? "items-end" : "items-start"}`}
                            >
                              <div
                                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                                  m.sender === "broker"
                                    ? "bg-primary text-primary-foreground"
                                    : "border border-border bg-background"
                                }`}
                              >
                                {m.content}
                              </div>
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                {m.sender_name} · {new Date(m.created_at).toLocaleString("fr-CH")}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && sendReply(r.id)}
                          placeholder="Votre message..."
                        />
                        <Button type="button" size="icon" onClick={() => sendReply(r.id)} disabled={sending}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  )
}