import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type FeedbackRow = {
  id: string;
  category: "bug" | "suggestion" | "calculation" | "ux" | "other";
  status: "new" | "in_review" | "planned" | "resolved" | "dismissed";
  subject: string;
  message: string;
  page_path: string | null;
  rating: number | null;
  created_at: string;
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

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_feedback")
      .select("id,category,status,subject,message,page_path,rating,created_at")
      .eq("broker_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) setRows((data ?? []) as FeedbackRow[]);
      });
  }, [user]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mes feedbacks</h1>
          <p className="text-sm text-muted-foreground">
            Historique des retours envoyés à l'équipe SwissBroker.
          </p>
        </div>
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
          {rows.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">{r.subject}</CardTitle>
                    <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{CATEGORY_LABEL[r.category]}</Badge>
                      <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      {r.rating != null && (
                        <span className="text-xs">Note : {r.rating}/5</span>
                      )}
                      <span className="text-xs">
                        {new Date(r.created_at).toLocaleString("fr-CH")}
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-foreground/90">{r.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}