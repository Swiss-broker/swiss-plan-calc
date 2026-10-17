import { useState } from "react";
import { MessageSquarePlus, Loader2, Send } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  category: z.enum(["bug", "suggestion", "calculation", "ux", "other"]),
  subject: z.string().trim().min(3, "Sujet trop court").max(140),
  message: z.string().trim().min(10, "Message trop court").max(4000),
  rating: z.number().int().min(1).max(5).optional(),
});

const CATEGORIES = [
  { value: "bug", label: "Bug / Erreur" },
  { value: "calculation", label: "Calcul incorrect" },
  { value: "suggestion", label: "Suggestion" },
  { value: "ux", label: "Ergonomie / UX" },
  { value: "other", label: "Autre" },
] as const;

export function FeedbackWidget({ onSubmitted }: { onSubmitted?: () => void } = {}) {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>("suggestion");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | undefined>(undefined);

  const reset = () => {
    setCategory("suggestion");
    setSubject("");
    setMessage("");
    setRating(undefined);
  };

  const submit = async () => {
    if (!user) return;
    const parsed = schema.safeParse({ category, subject, message, rating });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("user_feedback").insert({
      broker_id: user.id,
      category: parsed.data.category,
      subject: parsed.data.subject,
      message: parsed.data.message,
      rating: parsed.data.rating ?? null,
      page_path: pathname,
      context: {
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        viewport:
          typeof window !== "undefined"
            ? { w: window.innerWidth, h: window.innerHeight }
            : null,
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error("Envoi impossible : " + error.message);
      return;
    }
    toast.success("Merci ! Votre retour a bien été enregistré.");
    reset();
    setOpen(false);
    onSubmitted?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          className="gap-2"
          aria-label="Envoyer un retour"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Votre retour</DialogTitle>
          <DialogDescription>
            Bug, calcul incorrect, suggestion d'amélioration… Tout est utile.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fb-subject">Sujet</Label>
            <Input
              id="fb-subject"
              value={subject}
              maxLength={140}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Résumé en une phrase"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fb-message">Détails</Label>
            <Textarea
              id="fb-message"
              value={message}
              rows={5}
              maxLength={4000}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Décrivez ce qui s'est passé, ce que vous attendiez, et où dans l'app."
            />
            <p className="text-xs text-muted-foreground">
              Page courante envoyée automatiquement : <code>{pathname}</code>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Satisfaction (optionnel)</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(rating === n ? undefined : n)}
                  className={`h-9 w-9 rounded-md border text-sm font-medium transition ${
                    rating === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
