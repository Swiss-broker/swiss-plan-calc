// Calendrier / rendez-vous du courtier. Vues mois / semaine / jour /
// liste, création/modification/suppression, association à un client.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppointmentDialog } from "@/components/appointments/AppointmentDialog";
import { MonthView, WeekView, DayView, AppointmentListView } from "@/components/calendar/CalendarViews";
import type { Appointment } from "@/lib/appointments/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/calendar")({
  head: () => ({ meta: [{ title: "Calendrier · SwissBroker Pro" }] }),
  component: CalendarPage,
});

type ViewMode = "month" | "week" | "day" | "list";

const VIEW_LABELS: Record<ViewMode, string> = {
  month: "Mois",
  week: "Semaine",
  day: "Jour",
  list: "Liste",
};

function CalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [prefillDate, setPrefillDate] = useState<Date | null>(null);

  // Plage de dates à charger selon la vue active. La vue liste ignore le
  // curseur : elle regarde toujours vers l'avenir depuis aujourd'hui.
  const range = useMemo(() => {
    if (view === "month") {
      return { start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }) };
    }
    if (view === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      return { start, end: addDays(start, 6) };
    }
    if (view === "day") {
      return { start: cursor, end: cursor };
    }
    const start = new Date();
    return { start, end: addDays(start, 120) };
  }, [view, cursor]);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", user?.id, view, range.start.toDateString(), range.end.toDateString()],
    enabled: !!user,
    queryFn: async () => {
      const startIso = new Date(range.start.setHours(0, 0, 0, 0)).toISOString();
      const endIso = new Date(new Date(range.end).setHours(23, 59, 59, 999)).toISOString();
      const { data, error } = await supabase
        .from("appointments")
        .select("*, client:clients(first_name, last_name, email, phone)")
        .gte("starts_at", startIso)
        .lte("starts_at", endIso)
        .order("starts_at", { ascending: true })
        .limit(view === "list" ? 100 : 500);
      if (error) throw error;
      return (data ?? []) as unknown as Appointment[];
    },
  });

  const openCreate = (date?: Date) => {
    setEditing(null);
    setPrefillDate(date ?? cursor);
    setDialogOpen(true);
  };
  const openEdit = (a: Appointment) => {
    setEditing(a);
    setPrefillDate(null);
    setDialogOpen(true);
  };
  const goToDay = (d: Date) => {
    setCursor(d);
    setView("day");
  };

  const navigatePrev = () => {
    if (view === "month") setCursor((c) => addMonths(c, -1));
    else if (view === "week") setCursor((c) => addWeeks(c, -1));
    else if (view === "day") setCursor((c) => addDays(c, -1));
  };
  const navigateNext = () => {
    if (view === "month") setCursor((c) => addMonths(c, 1));
    else if (view === "week") setCursor((c) => addWeeks(c, 1));
    else if (view === "day") setCursor((c) => addDays(c, 1));
  };

  const headerLabel =
    view === "month"
      ? format(cursor, "MMMM yyyy", { locale: fr })
      : view === "week"
        ? `Semaine du ${format(startOfWeek(cursor, { weekStartsOn: 1 }), "d MMM", { locale: fr })}`
        : view === "day"
          ? format(cursor, "EEEE d MMMM yyyy", { locale: fr })
          : "Prochains rendez-vous";

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold sm:text-2xl">Calendrier</h1>
        </div>
        <Button onClick={() => openCreate()} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Nouveau rendez-vous
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-border">
            {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition",
                  view === v ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                )}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
          {view !== "list" && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigatePrev} aria-label="Précédent">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={() => setCursor(new Date())}>
                Aujourd'hui
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigateNext} aria-label="Suivant">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <p className="text-sm font-medium capitalize text-muted-foreground">{headerLabel}</p>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="rounded-xl border border-border p-10 text-center text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : view === "month" ? (
          <MonthView cursor={cursor} appointments={appointments} onDayClick={goToDay} onAppointmentClick={openEdit} />
        ) : view === "week" ? (
          <WeekView cursor={cursor} appointments={appointments} onDayClick={goToDay} onAppointmentClick={openEdit} />
        ) : view === "day" ? (
          <DayView
            cursor={cursor}
            appointments={appointments}
            onAppointmentClick={openEdit}
            onOpenClient={(id) => navigate({ to: "/clients/$clientId", params: { clientId: id } })}
          />
        ) : (
          <AppointmentListView
            appointments={appointments}
            onAppointmentClick={openEdit}
            onOpenClient={(id) => navigate({ to: "/clients/$clientId", params: { clientId: id } })}
          />
        )}
      </div>

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        appointment={editing}
        defaultDate={prefillDate}
      />
    </div>
  );
}
