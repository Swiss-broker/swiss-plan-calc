// Onglet "Synthèse RDV" sur la fiche client.
// Liste les simulations rattachées + agrège les gains chiffrables.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  FileText,
  Sparkles,
  Trash2,
  ExternalLink,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  KIND_LABELS,
  KIND_ROUTES,
  type HistoryEntry,
  type SimulationKind,
} from "@/lib/history/types";
import { aggregateGains } from "@/lib/simulations/extract-gain";
import { formatCHF } from "@/lib/format";
import { formatDateShort } from "@/lib/i18n/format";
import { useT } from "@/contexts/LanguageContext";
import { SynthesisReportModal } from "./SynthesisReportModal";

export function SessionSummaryTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const t = useT();
  const qc = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["client-simulations", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulation_history")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as HistoryEntry[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("simulation_history").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-simulations", clientId] });
      qc.invalidateQueries({ queryKey: ["simulation-history"] });
      toast.success(t("history.toast.deleted"));
    },
  });

  const agg = aggregateGains(entries);

  return (
    <div className="space-y-6">
      {/* BLOC 2 — Optimisations identifiées */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("client.session.optimizations_identified")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agg.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("client.session.no_gains")}
            </p>
          ) : (
            <>
              <ul className="space-y-3">
                {agg.items.map((g) => (
                  <li key={g.entryId} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{g.label}</div>
                      {g.details && (
                        <div className="text-xs text-muted-foreground">{g.details}</div>
                      )}
                      <div className="mt-1 text-sm font-semibold text-primary">
                        {g.type === "annual"
                          ? `${formatCHF(g.amount)} / ${t("client.session.per_year")}`
                          : formatCHF(g.amount)}
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          {g.type === "annual"
                            ? t("client.session.gain.annual")
                            : t("client.session.gain.one_time")}
                        </Badge>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <Separator className="my-4" />
              <div className="space-y-1">
                {agg.totalOneTime > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("client.session.total_one_time")}</span>
                    <span className="font-semibold">{formatCHF(agg.totalOneTime)}</span>
                  </div>
                )}
                {agg.totalAnnual > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("client.session.total_annual")}</span>
                    <span className="font-semibold">{formatCHF(agg.totalAnnual)} / {t("client.session.per_year")}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t pt-2 text-base">
                  <span className="font-semibold">{t("client.session.total_gain")}</span>
                  <span className="text-lg font-bold text-primary">
                    {formatCHF(agg.totalOneTime + agg.totalAnnual)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t("client.session.total_gain_hint")}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* BLOC 1 — Liste chronologique */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-5 w-5 text-primary" />
            {t("client.session.simulations_list", { n: entries.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("history.loading")}</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("client.session.empty_state")}</p>
          ) : (
            <ul className="space-y-3">
              {entries.map((e) => (
                <SimItem key={e.id} entry={e} onDelete={() => remove.mutate(e.id)} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* BLOC 3 — Bouton préparer dossier de synthèse PDF */}
      <div className="flex justify-end">
        <Button
          size="lg"
          className="gap-2 shine"
          onClick={() => setReportOpen(true)}
          disabled={entries.length === 0}
        >
          <FileText className="h-4 w-4" />
          {t("client.session.prepare_pdf_button", { name: clientName })}
        </Button>
      </div>

      <SynthesisReportModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        clientId={clientId}
        entries={entries}
      />
    </div>
  );
}

function SimItem({ entry, onDelete }: { entry: HistoryEntry; onDelete: () => void }) {
  const t = useT();
  const route = KIND_ROUTES[entry.kind] as "/calculators/lpp";
  return (
    <li className="flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/40">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{KIND_LABELS[entry.kind as SimulationKind]}</Badge>
          <span className="text-sm font-medium">{entry.title}</span>
        </div>
        {entry.note && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{entry.note}</p>
        )}
        <div className="mt-1 text-[11px] text-muted-foreground">
          {formatDateShort(entry.created_at)}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button asChild size="sm" variant="ghost" title={t("history.action.open_tooltip")}>
          <Link to={route}>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          title={t("history.action.delete_tooltip")}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </li>
  );
}
