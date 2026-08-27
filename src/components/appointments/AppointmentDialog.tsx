// Formulaire de création/modification d'un rendez-vous. Utilisé depuis
// le calendrier (src/routes/_app/calendar.tsx) et depuis la fiche client
// (bouton "Créer un rendez-vous").
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPE_SUGGESTIONS,
  REMINDER_PRESETS,
  STATUS_LABELS,
  type Appointment,
  type AppointmentStatus,
} from "@/lib/appointments/types";

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: Appointment | null;
  defaultClientId?: string | null;
  defaultDate?: Date | null;
  onSaved?: () => void;
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentDialog({
  open,
  onOpenChange,
  appointment,
  defaultClientId,
  defaultDate,
  onSaved,
}: AppointmentDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isEdit = !!appointment;

  const now = defaultDate ?? new Date();
  const [title, setTitle] = useState("");
  const [appointmentType, setAppointmentType] = useState("");
  const [clientId, setClientId] = useState<string>("none");
  const [date, setDate] = useState(toDateInput(now));
  const [time, setTime] = useState(toTimeInput(now));
  const [duration, setDuration] = useState(60);
  const [location, setLocation] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<AppointmentStatus>("planifie");
  const [reminderMinutes, setReminderMinutes] = useState<number[]>([]);
  const [customReminder, setCustomReminder] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (appointment) {
      const d = new Date(appointment.starts_at);
      setTitle(appointment.title);
      setAppointmentType(appointment.appointment_type ?? "");
      setClientId(appointment.client_id ?? "none");
      setDate(toDateInput(d));
      setTime(toTimeInput(d));
      setDuration(appointment.duration_minutes);
      setLocation(appointment.location ?? "");
      setVideoLink(appointment.video_link ?? "");
      setNote(appointment.note ?? "");
      setStatus(appointment.status);
    } else {
      const d = defaultDate ?? new Date();
      setTitle("");
      setAppointmentType("");
      setClientId(defaultClientId ?? "none");
      setDate(toDateInput(d));
      setTime(toTimeInput(d));
      setDuration(60);
      setLocation("");
      setVideoLink("");
      setNote("");
      setStatus("planifie");
      setReminderMinutes([]);
      setCustomReminder("");
    }
  }, [open, appointment, defaultClientId, defaultDate]);

  // Rappels déjà enregistrés, pour pré-cocher les cases en édition.
  const { data: existingReminders = [] } = useQuery({
    queryKey: ["appointment-reminders", appointment?.id],
    enabled: !!appointment?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_reminders")
        .select("remind_before_minutes")
        .eq("appointment_id", appointment!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.remind_before_minutes);
    },
  });
  useEffect(() => {
    if (appointment && existingReminders.length > 0) setReminderMinutes(existingReminders);
  }, [appointment, existingReminders]);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-appointment", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name")
        .eq("archived", false)
        .order("last_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleReminder = (minutes: number) => {
    setReminderMinutes((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes],
    );
  };
  const addCustomReminder = () => {
    const hours = Number(customReminder);
    if (!hours || hours <= 0) return;
    const minutes = Math.round(hours * 60);
    if (!reminderMinutes.includes(minutes)) setReminderMinutes((prev) => [...prev, minutes]);
    setCustomReminder("");
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non authentifié.");
      if (!title.trim()) throw new Error("Le titre est requis.");
      const startsAt = new Date(`${date}T${time}:00`);
      if (Number.isNaN(startsAt.getTime())) throw new Error("Date ou heure invalide.");

      const payload = {
        broker_id: user.id,
        client_id: clientId === "none" ? null : clientId,
        title: title.trim(),
        appointment_type: appointmentType.trim() || null,
        starts_at: startsAt.toISOString(),
        duration_minutes: duration,
        location: location.trim() || null,
        video_link: videoLink.trim() || null,
        note: note.trim() || null,
        status,
      };

      let appointmentId = appointment?.id;
      if (isEdit) {
        const { error } = await supabase.from("appointments").update(payload).eq("id", appointment!.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("appointments").insert(payload).select("id").single();
        if (error) throw error;
        appointmentId = data.id;
      }

      // Rappels : on remplace intégralement la liste (plus simple et sûr
      // qu'un diff, et le volume par RDV reste minime).
      if (appointmentId) {
        await supabase.from("appointment_reminders").delete().eq("appointment_id", appointmentId);
        if (reminderMinutes.length > 0) {
          await supabase.from("appointment_reminders").insert(
            reminderMinutes.map((minutes) => ({
              appointment_id: appointmentId,
              remind_before_minutes: minutes,
            })),
          );
        }
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Rendez-vous modifié" : "Rendez-vous créé");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["next-appointment"] });
      onOpenChange(false);
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!appointment) return;
      const { error } = await supabase.from("appointments").delete().eq("id", appointment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rendez-vous supprimé");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["next-appointment"] });
      setConfirmDeleteOpen(false);
      onOpenChange(false);
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Modifier le rendez-vous" : "Créer un rendez-vous"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Mettez à jour les informations du rendez-vous."
                : "Planifiez un nouveau rendez-vous, lié à un client ou interne."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="appt-title">Titre</Label>
              <Input
                id="appt-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex. Rendez-vous prévoyance"
                list="appt-type-suggestions"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appt-type">Type (optionnel)</Label>
              <Input
                id="appt-type"
                value={appointmentType}
                onChange={(e) => setAppointmentType(e.target.value)}
                placeholder="Ex. Analyse retraite"
                list="appt-type-suggestions"
              />
              <datalist id="appt-type-suggestions">
                {APPOINTMENT_TYPE_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appt-client">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="appt-client">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun (rendez-vous interne)</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="appt-date">Date</Label>
                <Input id="appt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="appt-time">Heure</Label>
                <Input id="appt-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appt-duration">Durée</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                <SelectTrigger id="appt-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m >= 60 ? `${m / 60} h${m % 60 ? ` ${m % 60}` : ""}` : `${m} min`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="appt-location">Lieu (optionnel)</Label>
                <Input
                  id="appt-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex. Cabinet, Genève"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="appt-video">Lien visio (optionnel)</Label>
                <Input
                  id="appt-video"
                  value={videoLink}
                  onChange={(e) => setVideoLink(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>

            {isEdit && (
              <div className="space-y-1.5">
                <Label htmlFor="appt-status">Statut</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as AppointmentStatus)}>
                  <SelectTrigger id="appt-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="appt-note">Note (optionnel)</Label>
              <Textarea
                id="appt-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Notes de préparation, contexte..."
              />
            </div>

            <div className="space-y-2">
              <Label>Rappels</Label>
              <div className="space-y-2">
                {REMINDER_PRESETS.map((p) => (
                  <label key={p.minutes} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={reminderMinutes.includes(p.minutes)}
                      onCheckedChange={() => toggleReminder(p.minutes)}
                    />
                    {p.label}
                  </label>
                ))}
                {reminderMinutes
                  .filter((m) => !REMINDER_PRESETS.some((p) => p.minutes === m))
                  .map((m) => (
                    <label key={m} className="flex items-center gap-2 text-sm">
                      <Checkbox checked onCheckedChange={() => toggleReminder(m)} />
                      Personnalisé — {(m / 60).toString().replace(".", ",")} h avant
                    </label>
                  ))}
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0.25}
                    step={0.25}
                    value={customReminder}
                    onChange={(e) => setCustomReminder(e.target.value)}
                    placeholder="Personnalisé (heures avant)"
                    className="h-8 w-48"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addCustomReminder}>
                    Ajouter
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            {isEdit ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" /> Supprimer
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce rendez-vous ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Le rendez-vous et ses rappels seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => remove.mutate()}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
