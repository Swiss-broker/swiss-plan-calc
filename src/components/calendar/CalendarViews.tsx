// Vues du calendrier (mois / semaine / jour / liste). Volontairement
// simples : pas de grille horaire pixel-parfaite façon Outlook, une liste
// chronologique par jour suffit pour l'usage "RDV client" visé.
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import { FolderOpen, MapPin, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { appointmentEndsAt, STATUS_COLORS, STATUS_LABELS, type Appointment } from "@/lib/appointments/types";

function clientLabel(a: Appointment): string {
  return a.client ? `${a.client.first_name} ${a.client.last_name}`.trim() : "RDV interne";
}

function StatusDot({ status }: { status: Appointment["status"] }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        status === "annule" && "bg-rose-500",
        status === "confirme" && "bg-emerald-500",
        status === "planifie" && "bg-blue-500",
        status === "reporte" && "bg-amber-500",
        status === "termine" && "bg-muted-foreground",
      )}
    />
  );
}

// ───────────────────────── Vue mois ─────────────────────────

export function MonthView({
  cursor,
  appointments,
  onDayClick,
  onAppointmentClick,
}: {
  cursor: Date;
  appointments: Appointment[];
  onDayClick: (d: Date) => void;
  onAppointmentClick: (a: Appointment) => void;
}) {
  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
        {weekdays.map((w) => (
          <div key={w} className="px-2 py-2 text-center">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayAppointments = appointments
            .filter((a) => isSameDay(new Date(a.starts_at), day))
            .sort((x, y) => x.starts_at.localeCompare(y.starts_at));
          const inMonth = isSameMonth(day, cursor);
          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                "min-h-[92px] border-b border-r border-border/60 p-1.5 text-left align-top transition hover:bg-muted/40 sm:min-h-[110px] sm:p-2",
                !inMonth && "bg-muted/20 text-muted-foreground/50",
              )}
            >
              <div
                className={cn(
                  "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  isToday(day) && "bg-primary text-primary-foreground",
                )}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayAppointments.slice(0, 3).map((a) => (
                  <div
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick(a);
                    }}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] hover:bg-muted"
                  >
                    <StatusDot status={a.status} />
                    <span className="truncate">
                      {format(new Date(a.starts_at), "HH:mm")} {clientLabel(a)}
                    </span>
                  </div>
                ))}
                {dayAppointments.length > 3 && (
                  <div className="px-1 text-[10px] text-muted-foreground">
                    +{dayAppointments.length - 3} autre{dayAppointments.length - 3 > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────── Vue semaine ─────────────────────────

export function WeekView({
  cursor,
  appointments,
  onDayClick,
  onAppointmentClick,
}: {
  cursor: Date;
  appointments: Appointment[];
  onDayClick: (d: Date) => void;
  onAppointmentClick: (a: Appointment) => void;
}) {
  const weekStart = startOfWeek(cursor, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((day) => {
        const dayAppointments = appointments
          .filter((a) => isSameDay(new Date(a.starts_at), day))
          .sort((x, y) => x.starts_at.localeCompare(y.starts_at));
        return (
          <div key={day.toISOString()} className="rounded-xl border border-border">
            <button
              type="button"
              onClick={() => onDayClick(day)}
              className="flex w-full items-center justify-between border-b border-border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50"
            >
              <span className="text-sm font-medium capitalize">{format(day, "EEE d MMM", { locale: fr })}</span>
              {isToday(day) && <Badge className="h-5 px-1.5 text-[10px]">Aujourd'hui</Badge>}
            </button>
            <div className="min-h-[80px] space-y-1.5 p-2">
              {dayAppointments.length === 0 && (
                <p className="px-1 py-2 text-center text-xs text-muted-foreground">Aucun RDV</p>
              )}
              {dayAppointments.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => onAppointmentClick(a)}
                  className="flex w-full items-start gap-1.5 rounded-lg border border-border/60 p-2 text-left text-xs hover:bg-muted/50"
                >
                  <StatusDot status={a.status} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{format(new Date(a.starts_at), "HH:mm")}</div>
                    <div className="truncate text-muted-foreground">{clientLabel(a)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────── Vue jour ─────────────────────────

export function DayView({
  cursor,
  appointments,
  onAppointmentClick,
  onOpenClient,
}: {
  cursor: Date;
  appointments: Appointment[];
  onAppointmentClick: (a: Appointment) => void;
  onOpenClient: (clientId: string) => void;
}) {
  const dayAppointments = appointments
    .filter((a) => isSameDay(new Date(a.starts_at), cursor))
    .sort((x, y) => x.starts_at.localeCompare(y.starts_at));

  if (dayAppointments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Aucun rendez-vous ce jour-là.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {dayAppointments.map((a) => (
        <div key={a.id} className="flex items-start gap-3 rounded-xl border border-border p-4">
          <div className="w-16 shrink-0 pt-0.5 text-sm font-semibold tabular-nums">
            {format(new Date(a.starts_at), "HH:mm")}
          </div>
          <button type="button" onClick={() => onAppointmentClick(a)} className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{a.title}</span>
              <Badge className={cn("text-[10px]", STATUS_COLORS[a.status])}>{STATUS_LABELS[a.status]}</Badge>
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              {clientLabel(a)} · {a.duration_minutes} min
              {a.appointment_type ? ` · ${a.appointment_type}` : ""}
            </div>
            {(a.location || a.video_link) && (
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {a.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {a.location}
                  </span>
                )}
                {a.video_link && (
                  <span className="flex items-center gap-1">
                    <Video className="h-3 w-3" /> Visioconférence
                  </span>
                )}
              </div>
            )}
          </button>
          {a.client_id && (
            <button
              type="button"
              onClick={() => onOpenClient(a.client_id!)}
              className="flex shrink-0 items-center gap-1 self-center rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              <FolderOpen className="h-3.5 w-3.5" /> Ouvrir le dossier
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── Vue liste (prochains RDV) ─────────────────────────

export function AppointmentListView({
  appointments,
  onAppointmentClick,
  onOpenClient,
}: {
  appointments: Appointment[];
  onAppointmentClick: (a: Appointment) => void;
  onOpenClient: (clientId: string) => void;
}) {
  if (appointments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Aucun rendez-vous à venir.
      </div>
    );
  }

  const grouped = appointments.reduce<Record<string, Appointment[]>>((acc, a) => {
    const key = format(new Date(a.starts_at), "yyyy-MM-dd");
    (acc[key] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([dateKey, items]) => (
        <div key={dateKey}>
          <h3 className="mb-2 text-sm font-semibold capitalize text-muted-foreground">
            {format(new Date(dateKey), "EEEE d MMMM yyyy", { locale: fr })}
          </h3>
          <div className="space-y-2">
            {items.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="w-14 shrink-0 text-sm font-semibold tabular-nums">
                  {format(new Date(a.starts_at), "HH:mm")}
                </div>
                <button type="button" onClick={() => onAppointmentClick(a)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{a.title}</span>
                    <Badge className={cn("text-[10px]", STATUS_COLORS[a.status])}>{STATUS_LABELS[a.status]}</Badge>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{clientLabel(a)}</div>
                </button>
                {a.client_id && (
                  <button
                    type="button"
                    onClick={() => onOpenClient(a.client_id!)}
                    className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"
                    aria-label="Ouvrir le dossier"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export { appointmentEndsAt };
