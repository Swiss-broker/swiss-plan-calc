// Carte "Prochain rendez-vous" affichée sur la fiche client : montre le
// prochain RDV à venir pour ce client et permet d'en créer un nouveau.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarPlus, Clock, MapPin, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppointmentDialog } from "@/components/appointments/AppointmentDialog";
import { STATUS_COLORS, STATUS_LABELS, type Appointment } from "@/lib/appointments/types";
import { cn } from "@/lib/utils";

export function NextAppointmentCard({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

  const { data: next, isLoading } = useQuery({
    queryKey: ["next-appointment", clientId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("client_id", clientId)
        .neq("status", "annule")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Appointment | null;
    },
  });

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Prochain rendez-vous
        </h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <CalendarPlus className="h-4 w-4" /> Créer un rendez-vous
        </Button>
      </div>

      <div className="mt-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : !next ? (
          <p className="text-sm text-muted-foreground">Aucun rendez-vous à venir pour ce client.</p>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditing(next);
              setDialogOpen(true);
            }}
            className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 text-left"
          >
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {format(new Date(next.starts_at), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </span>
            {next.appointment_type && (
              <span className="text-sm text-muted-foreground">{next.appointment_type}</span>
            )}
            <Badge className={cn("text-[10px]", STATUS_COLORS[next.status])}>{STATUS_LABELS[next.status]}</Badge>
            {next.location && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {next.location}
              </span>
            )}
            {next.video_link && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Video className="h-3 w-3" /> Visioconférence
              </span>
            )}
          </button>
        )}
      </div>

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        appointment={editing}
        defaultClientId={clientId}
      />
    </div>
  );
}
