// Suivi post-rendez-vous (Partie 4 du cahier des charges "cockpit RDV").
// Affiche, pour chaque RDV passe a "Termine", une section "SUIVI DU
// RENDEZ-VOUS" (compte rendu, notes, taches, documents, relance, prochain
// RDV) ainsi que la liste "PROCHAINES ACTIONS" partagee par toutes ces
// taches. Reutilise l'IA existante (edge function ai-chat, meme pattern
// que AiAnalysis.tsx) et les briques deja construites (documents, e-mails,
// rendez-vous) plutot que d'en recreer des doublons. Aucun calculateur
// touche.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  FileText,
  StickyNote,
  ListTodo,
  FolderOpen,
  Mail,
  CalendarPlus,
  Clock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase as _supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { STATUS_COLORS, STATUS_LABELS, type Appointment } from "@/lib/appointments/types";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/lib/documents/categories";
import { AppointmentDialog } from "@/components/appointments/AppointmentDialog";
import { EmailComposerDialog } from "@/components/clients/EmailComposerDialog";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

type Priority = "basse" | "normale" | "haute";
type TaskStatus = "a_faire" | "en_cours" | "termine";

interface FollowUpTask {
  id: string;
  title: string;
  due_date: string | null;
  priority: Priority;
  status: TaskStatus;
  appointment_id: string | null;
}

interface AppointmentReport {
  id: string;
  appointment_id: string;
  content: string;
  generated_by: "manuel" | "ia";
}

const PRIORITY_LABELS: Record<Priority, string> = { basse: "Basse", normale: "Normale", haute: "Haute" };
const PRIORITY_COLORS: Record<Priority, string> = {
  basse: "bg-muted text-muted-foreground",
  normale: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  haute: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function FollowUpTab({ clientId, clientFirstName }: { clientId: string; clientFirstName: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [taskDialog, setTaskDialog] = useState<{ appointmentId: string | null; defaultTitle?: string } | null>(null);
  const [relanceAppointment, setRelanceAppointment] = useState<Appointment | null>(null);
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [newAppointmentDialogOpen, setNewAppointmentDialogOpen] = useState(false);

  const appointmentsQuery = useQuery({
    queryKey: ["client-completed-appointments", clientId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("client_id", clientId)
        .eq("status", "termine")
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Appointment[];
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["client-followups", clientId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_followups")
        .select("id,title,due_date,priority,status,appointment_id")
        .eq("client_id", clientId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as FollowUpTask[];
    },
  });

  const reportsQuery = useQuery({
    queryKey: ["appointment-reports", clientId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_reports")
        .select("id,appointment_id,content,generated_by")
        .eq("client_id", clientId);
      if (error) throw error;
      return (data || []) as AppointmentReport[];
    },
  });

  const reportsByAppointment = new Map<string, AppointmentReport>();
  for (const r of reportsQuery.data || []) reportsByAppointment.set(r.appointment_id, r);

  const invalidateTasks = () => qc.invalidateQueries({ queryKey: ["client-followups", clientId] });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const { error } = await supabase.from("client_followups").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateTasks,
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_followups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateTasks();
      toast.success("Tâche supprimée.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Prochaines actions</h3>
            <p className="mt-1 text-sm text-muted-foreground">Tâches de suivi pour {clientFirstName}.</p>
          </div>
          <Button size="sm" onClick={() => setTaskDialog({ appointmentId: null })} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nouvelle tâche
          </Button>
        </div>

        {tasksQuery.isLoading ? (
          <Loader2 className="mt-4 h-4 w-4 animate-spin" />
        ) : (tasksQuery.data || []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Aucune tâche de suivi pour ce client.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Priorité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tasksQuery.data || []).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="max-w-[220px] truncate text-sm font-medium">{t.title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(t.due_date)}</TableCell>
                    <TableCell>
                      <Badge className={PRIORITY_COLORS[t.priority]}>{PRIORITY_LABELS[t.priority]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={t.status}
                        onValueChange={(v) => updateTaskStatus.mutate({ id: t.id, status: v as TaskStatus })}
                      >
                        <SelectTrigger className="h-8 w-[130px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a_faire">À faire</SelectItem>
                          <SelectItem value="en_cours">En cours</SelectItem>
                          <SelectItem value="termine">Terminé</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteTask.mutate(t.id)}
                        aria-label="Supprimer la tâche"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <div>
        <h3 className="mb-3 text-lg font-semibold">Suivi des rendez-vous</h3>
        {appointmentsQuery.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (appointmentsQuery.data || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun rendez-vous terminé pour ce client pour le moment.</p>
        ) : (
          <div className="space-y-4">
            {(appointmentsQuery.data || []).map((appt) => (
              <AppointmentFollowUpCard
                key={appt.id}
                appointment={appt}
                clientId={clientId}
                clientFirstName={clientFirstName}
                report={reportsByAppointment.get(appt.id) ?? null}
                onReportSaved={() => qc.invalidateQueries({ queryKey: ["appointment-reports", clientId] })}
                onAddNote={() => qc.invalidateQueries({ queryKey: ["client", clientId] })}
                onCreateTask={() =>
                  setTaskDialog({ appointmentId: appt.id, defaultTitle: `Suivi : ${appt.title}` })
                }
                onRequestDocument={() => setDocDialogOpen(true)}
                onScheduleRelance={() => setRelanceAppointment(appt)}
                onScheduleNextAppointment={() => setNewAppointmentDialogOpen(true)}
              />
            ))}
          </div>
        )}
      </div>

      <TaskDialog
        open={!!taskDialog}
        onOpenChange={(o) => !o && setTaskDialog(null)}
        clientId={clientId}
        appointmentId={taskDialog?.appointmentId ?? null}
        defaultTitle={taskDialog?.defaultTitle}
        onSaved={() => {
          invalidateTasks();
          setTaskDialog(null);
        }}
      />

      <RelanceDialog
        appointment={relanceAppointment}
        clientId={clientId}
        clientFirstName={clientFirstName}
        onOpenChange={(o) => !o && setRelanceAppointment(null)}
        onScheduled={() => {
          invalidateTasks();
          setRelanceAppointment(null);
        }}
        onSendNow={() => {
          setRelanceAppointment(null);
          setEmailComposerOpen(true);
        }}
      />

      <RequestDocumentDialog open={docDialogOpen} onOpenChange={setDocDialogOpen} clientId={clientId} />

      <EmailComposerDialog
        clientId={clientId}
        open={emailComposerOpen}
        onOpenChange={setEmailComposerOpen}
        defaultTemplateKey="suivi_post_rdv"
      />

      <AppointmentDialog
        open={newAppointmentDialogOpen}
        onOpenChange={setNewAppointmentDialogOpen}
        defaultClientId={clientId}
      />
    </div>
  );
}

function AppointmentFollowUpCard({
  appointment,
  clientId,
  clientFirstName,
  report,
  onReportSaved,
  onAddNote,
  onCreateTask,
  onRequestDocument,
  onScheduleRelance,
  onScheduleNextAppointment,
}: {
  appointment: Appointment;
  clientId: string;
  clientFirstName: string;
  report: AppointmentReport | null;
  onReportSaved: () => void;
  onAddNote: () => void;
  onCreateTask: () => void;
  onRequestDocument: () => void;
  onScheduleRelance: () => void;
  onScheduleNextAppointment: () => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportContent, setReportContent] = useState(report?.content ?? "");
  const [reportSource, setReportSource] = useState<"manuel" | "ia">(report?.generated_by ?? "manuel");
  const [reportLoading, setReportLoading] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const generateReport = async () => {
    setReportLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          system:
            "Tu es un assistant qui rédige des comptes rendus de rendez-vous clients pour un courtier en prévoyance et fiscalité suisse. Tu réponds en français, sans emojis, sans astérisques, en texte brut structuré.",
          messages: [
            {
              role: "user",
              content: `Rédige un compte rendu de rendez-vous concis et professionnel.

RENDEZ-VOUS : ${appointment.title}${appointment.appointment_type ? ` (${appointment.appointment_type})` : ""}
DATE : ${format(new Date(appointment.starts_at), "d MMMM yyyy", { locale: fr })}
CLIENT : ${clientFirstName}
NOTES PRISES PENDANT LE RDV : ${appointment.note || "aucune note"}

Structure attendue :
1. POINTS ABORDÉS
2. DÉCISIONS PRISES
3. SUITE À DONNER

Texte brut, tirets simples pour les listes, sans emojis ni astérisques.`,
            },
          ],
        },
      });
      if (error) throw error;
      setReportContent(data.content?.[0]?.text ?? "");
      setReportSource("ia");
      setReportOpen(true);
    } catch {
      toast.error("Impossible de générer le compte rendu. Réessayez.");
    } finally {
      setReportLoading(false);
    }
  };

  const saveReport = async () => {
    if (!user) return;
    setSavingReport(true);
    try {
      const { error } = await supabase.from("appointment_reports").upsert(
        {
          appointment_id: appointment.id,
          client_id: clientId,
          broker_id: user.id,
          content: reportContent,
          generated_by: reportSource,
        },
        { onConflict: "appointment_id" },
      );
      if (error) throw error;
      toast.success("Compte rendu enregistré.");
      onReportSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'enregistrement.");
    } finally {
      setSavingReport(false);
    }
  };

  const saveNote = async () => {
    if (!user || !noteBody.trim()) return;
    setSavingNote(true);
    try {
      const { error } = await supabase.from("client_notes").insert({
        client_id: clientId,
        broker_id: user.id,
        body: `[Suivi RDV du ${format(new Date(appointment.starts_at), "d MMMM yyyy", { locale: fr })}] ${noteBody.trim()}`,
      });
      if (error) throw error;
      toast.success("Note ajoutée.");
      setNoteBody("");
      setNoteOpen(false);
      onAddNote();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'enregistrement.");
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <Card className="p-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{appointment.title}</p>
            <Badge className={STATUS_COLORS.termine}>{STATUS_LABELS.termine}</Badge>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {format(new Date(appointment.starts_at), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Suivi du rendez-vous
            </h4>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setReportOpen((v) => !v)}>
                <FileText className="h-3.5 w-3.5" /> Compte rendu
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setNoteOpen((v) => !v)}>
                <StickyNote className="h-3.5 w-3.5" /> Ajouter une note
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={onCreateTask}>
                <ListTodo className="h-3.5 w-3.5" /> Créer une tâche
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={onRequestDocument}>
                <FolderOpen className="h-3.5 w-3.5" /> Demander un document
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={onScheduleRelance}>
                <Mail className="h-3.5 w-3.5" /> Programmer une relance
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={onScheduleNextAppointment}>
                <CalendarPlus className="h-3.5 w-3.5" /> Prochain rendez-vous
              </Button>
            </div>
          </div>

          {reportOpen && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {reportSource === "ia" ? "Généré par l'IA (modifiable)" : report ? "Rédigé manuellement" : "Aucun compte rendu enregistré"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={generateReport}
                  disabled={reportLoading}
                >
                  {reportLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {reportLoading ? "Génération..." : "Générer avec l'IA"}
                </Button>
              </div>
              <Textarea
                value={reportContent}
                onChange={(e) => {
                  setReportContent(e.target.value);
                  setReportSource("manuel");
                }}
                rows={8}
                placeholder="Rédigez le compte rendu, ou générez-le avec l'IA."
                className="mt-2 bg-card"
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setReportOpen(false)}>
                  Fermer
                </Button>
                <Button size="sm" disabled={savingReport || !reportContent.trim()} onClick={saveReport}>
                  Enregistrer
                </Button>
              </div>
            </div>
          )}

          {noteOpen && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <Textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                rows={3}
                placeholder="Note interne liée à ce rendez-vous..."
                className="bg-card"
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setNoteOpen(false)}>
                  Annuler
                </Button>
                <Button size="sm" disabled={savingNote || !noteBody.trim()} onClick={saveNote}>
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function TaskDialog({
  open,
  onOpenChange,
  clientId,
  appointmentId,
  defaultTitle,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  appointmentId: string | null;
  defaultTitle?: string;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("normale");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle ?? "");
      setDueDate("");
      setPriority("normale");
    }
  }, [open, defaultTitle]);

  const save = async () => {
    if (!user || !title.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("client_followups").insert({
        broker_id: user.id,
        client_id: clientId,
        appointment_id: appointmentId,
        title: title.trim(),
        due_date: dueDate || null,
        priority,
        status: "a_faire",
      });
      if (error) throw error;
      toast.success("Tâche créée.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la création.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle tâche</DialogTitle>
          <DialogDescription>Elle apparaîtra dans les prochaines actions de ce client.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Titre</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Envoyer la simulation LPP" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Échéance</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basse">Basse</SelectItem>
                  <SelectItem value="normale">Normale</SelectItem>
                  <SelectItem value="haute">Haute</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={saving || !title.trim()} onClick={save}>
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestDocumentDialog({
  open,
  onOpenChange,
  clientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pending, setPending] = useState<DocumentCategory | null>(null);

  const request = async (category: DocumentCategory) => {
    if (!user) return;
    setPending(category);
    try {
      const { error } = await supabase.from("client_document_requests").upsert(
        {
          client_id: clientId,
          broker_id: user.id,
          category,
          status: "demande",
          requested_at: new Date().toISOString(),
          reminder_sent_at: null,
        },
        { onConflict: "client_id,category" },
      );
      if (error) throw error;
      toast.success("Document demandé.");
      qc.invalidateQueries({ queryKey: ["client-document-requests", clientId] });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la demande.");
    } finally {
      setPending(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Demander un document</DialogTitle>
          <DialogDescription>La demande apparaîtra dans l'onglet Documents de la fiche client.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {DOCUMENT_CATEGORIES.map((cat) => (
            <Button
              key={cat.value}
              size="sm"
              variant="outline"
              className="justify-start gap-1.5"
              disabled={pending === cat.value}
              onClick={() => request(cat.value)}
            >
              {pending === cat.value && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {cat.label}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RelanceDialog({
  appointment,
  clientId,
  clientFirstName,
  onOpenChange,
  onScheduled,
  onSendNow,
}: {
  appointment: Appointment | null;
  clientId: string;
  clientFirstName: string;
  onOpenChange: (open: boolean) => void;
  onScheduled: () => void;
  onSendNow: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (appointment) {
      setTitle(`Relancer ${clientFirstName}`);
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setDueDate(d.toISOString().slice(0, 10));
    }
  }, [appointment, clientFirstName]);

  const schedule = async () => {
    if (!user || !appointment || !title.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("client_followups").insert({
        broker_id: user.id,
        client_id: clientId,
        appointment_id: appointment.id,
        title: title.trim(),
        due_date: dueDate || null,
        priority: "normale",
        status: "a_faire",
      });
      if (error) throw error;
      toast.success("Relance programmée. Rien n'est envoyé automatiquement : vous déciderez vous-même du moment.");
      onScheduled();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la programmation.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!appointment} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Programmer une relance</DialogTitle>
          <DialogDescription>
            Crée une tâche de suivi à la date choisie. Aucun e-mail n'est envoyé automatiquement : vous gardez la main.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Titre</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Relancer le</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" className="gap-1.5" onClick={onSendNow}>
            <Mail className="h-3.5 w-3.5" /> Envoyer un e-mail maintenant
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button disabled={saving || !title.trim()} onClick={schedule}>
              Programmer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
