// Types et libellés partagés pour le calendrier / rendez-vous.
export type AppointmentStatus = "planifie" | "confirme" | "termine" | "annule" | "reporte";

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "planifie",
  "confirme",
  "termine",
  "annule",
  "reporte",
];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  planifie: "Planifié",
  confirme: "Confirmé",
  termine: "Terminé",
  annule: "Annulé",
  reporte: "Reporté",
};

// Couleurs sobres cohérentes avec le reste de l'app (badges de statut).
export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  planifie: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  confirme: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  termine: "bg-muted text-muted-foreground",
  annule: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  reporte: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
};

// Types de RDV suggérés (liste libre : le courtier peut saisir autre chose).
export const APPOINTMENT_TYPE_SUGGESTIONS = [
  "Rendez-vous prévoyance",
  "Analyse retraite",
  "Bilan patrimonial",
  "Point fiscal",
  "Suivi client",
  "Rendez-vous interne",
] as const;

// Rappels proposés par défaut, en minutes avant le RDV.
export const REMINDER_PRESETS = [
  { label: "24 heures avant", minutes: 24 * 60 },
  { label: "2 heures avant", minutes: 2 * 60 },
  { label: "30 minutes avant", minutes: 30 },
] as const;

export interface Appointment {
  id: string;
  broker_id: string;
  client_id: string | null;
  title: string;
  appointment_type: string | null;
  starts_at: string;
  duration_minutes: number;
  location: string | null;
  video_link: string | null;
  note: string | null;
  status: AppointmentStatus;
  created_at: string;
  updated_at: string;
  client?: { first_name: string; last_name: string; email: string | null; phone: string | null } | null;
}

export function appointmentEndsAt(a: Pick<Appointment, "starts_at" | "duration_minutes">): Date {
  return new Date(new Date(a.starts_at).getTime() + a.duration_minutes * 60_000);
}
