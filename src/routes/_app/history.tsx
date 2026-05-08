import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  FileDown,
  GitCompare,
  Loader2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  KIND_LABELS,
  KIND_ROUTES,
  type HistoryEntry,
  type SimulationKind,
} from "@/lib/history/types";
import { extractKpis, regeneratePdf } from "@/lib/history/registry";
import { ShareSimulationButton } from "@/components/calculators/ShareSimulationButton";
import { formatCHF } from "@/lib/format";
import { formatDateShort } from "@/lib/i18n/format";

export const Route = createFileRoute("/_app/history")({
  head: () => ({ meta: [{ title: "Historique des simulations · SwissBroker Pro" }] }),
  component: HistoryPage,
});

const ALL_KINDS: SimulationKind[] = [
  "income_tax",
  "source_tax",
  "lpp",
  "pillar3a",
  "retirement",
  "canton_compare",
];

function HistoryPage() {
  const { user } = useAuth();
  const t = useT();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<SimulationKind | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<HistoryEntry | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["simulation-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulation_history")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as HistoryEntry[];
    },
  });

  const { data: clientsMap = {} } = useQuery({
    queryKey: ["clients-map", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name");
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((c) => {
        map[c.id] = `${c.last_name ?? ""} ${c.first_name ?? ""}`.trim() || t("history.row.client_default");
      });
      return map;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (kindFilter !== "all" && e.kind !== kindFilter) return false;
      if (!q) return true;
      const hay = [
        e.title,
        e.note ?? "",
        KIND_LABELS[e.kind],
        ...(e.tags ?? []),
        clientsMap[e.client_id ?? ""] ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, search, kindFilter, clientsMap]);

  const selectedEntries = useMemo(
    () => entries.filter((e) => selected.has(e.id)),
    [entries, selected],
  );

  const compareKind = useMemo<SimulationKind | null>(() => {
    if (selectedEntries.length < 2) return null;
    const first = selectedEntries[0].kind;
    return selectedEntries.every((e) => e.kind === first) ? first : null;
  }, [selectedEntries]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      else toast.warning(t("history.toast.max"));
      return next;
    });
  };

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("simulation_history").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["simulation-history"] });
      toast.success(t("history.toast.deleted"));
      setPendingDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleRegenerate = async (e: HistoryEntry) => {
    try {
      await regeneratePdf(e.kind, e.inputs, user?.email ?? undefined);
    } catch (err) {
      toast.error((err as Error).message ?? t("history.toast.regenerate_error"));
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Bookmark className="h-7 w-7 text-primary" />
            {t("history.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("history.subtitle")}
          </p>
        </div>
        {selected.size >= 2 && (
          <Button
            onClick={() => setShowCompare((v) => !v)}
            className="gap-2 bg-gradient-primary text-primary-foreground shadow-elegant"
            disabled={!compareKind}
            title={!compareKind ? t("history.compare.disabled") : ""}
          >
            <GitCompare className="h-4 w-4" />
            {showCompare ? t("history.compare.hide") : t("history.compare.show", { n: selected.size })}
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("history.search.placeholder")}
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as typeof kindFilter)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("history.filter.all")}</SelectItem>
              {ALL_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setSelected(new Set());
                setShowCompare(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
              {t("history.deselect", { n: selected.size })}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Comparison panel */}
      {showCompare && compareKind && selectedEntries.length >= 2 && (
        <ComparisonPanel kind={compareKind} entries={selectedEntries} />
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filtered.length > 1
              ? t("history.count.plural", { n: filtered.length })
              : t("history.count", { n: filtered.length })}
          </CardTitle>
          <CardDescription>
            {t("history.count.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("history.empty")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>{t("history.col.title")}</TableHead>
                    <TableHead>{t("history.col.type")}</TableHead>
                    <TableHead>{t("history.col.client")}</TableHead>
                    <TableHead>{t("history.col.tags")}</TableHead>
                    <TableHead>{t("history.col.date")}</TableHead>
                    <TableHead className="text-right">{t("history.col.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => {
                    const checked = selected.has(e.id);
                    const sameKindOrEmpty =
                      selected.size === 0 ||
                      selectedEntries.some((s) => s.kind === e.kind);
                    return (
                      <TableRow key={e.id} className={checked ? "bg-primary/5" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            disabled={!checked && !sameKindOrEmpty}
                            onCheckedChange={() => toggle(e.id)}
                            aria-label={t("history.action.select")}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{e.title}</div>
                          {e.note && (
                            <div className="line-clamp-1 text-xs text-muted-foreground">
                              {e.note}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{KIND_LABELS[e.kind]}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {e.client_id ? clientsMap[e.client_id] ?? "—" : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(e.tags ?? []).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[10px]">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateShort(e.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              title={t("history.action.open_tooltip")}
                              asChild
                            >
                              <Link
                                to={KIND_ROUTES[e.kind] as "/calculators/income-tax"}
                              >
                                {t("history.action.open")}
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRegenerate(e)}
                              title={t("history.action.regenerate_pdf")}
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                            <ShareSimulationButton simulationId={e.id} />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPendingDelete(e)}
                              title={t("history.action.delete_tooltip")}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("history.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("history.delete.desc", { title: pendingDelete?.title ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ComparisonPanel({
  kind,
  entries,
}: {
  kind: SimulationKind;
  entries: HistoryEntry[];
}) {
  const t = useT();
  // Build KPI matrix: rows = KPI labels, cols = entries
  const kpiSets = entries.map((e) => extractKpis(kind, e.summary));
  const labels = kpiSets[0]?.map((k) => k.label) ?? [];

  const formatVal = (v: number | string, unit?: string | null) => {
    if (typeof v === "string") return v;
    if (unit === "CHF") return formatCHF(v);
    if (unit === "%") return `${v.toFixed(2)} %`;
    return v.toLocaleString("fr-CH");
  };

  const computeDelta = (rowIdx: number, colIdx: number): string => {
    if (colIdx === 0) return "";
    const base = kpiSets[0][rowIdx];
    const cur = kpiSets[colIdx][rowIdx];
    if (typeof base.value !== "number" || typeof cur.value !== "number") return "";
    const d = cur.value - base.value;
    if (d === 0) return "";
    const sign = d > 0 ? "+" : "";
    const pct = base.value !== 0 ? ` (${sign}${((d / Math.abs(base.value)) * 100).toFixed(1)} %)` : "";
    if (base.unit === "CHF")
      return `${sign}${formatCHF(d).replace("CHF ", "")} CHF${pct}`;
    if (base.unit === "%") return `${sign}${d.toFixed(2)} pts`;
    return `${sign}${d}`;
  };

  return (
    <Card className="mb-4 border-primary/40 bg-primary/[0.02]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitCompare className="h-5 w-5 text-primary" />
          {t("history.compare.title", { kind: KIND_LABELS[kind] })}
        </CardTitle>
        <CardDescription>
          {t("history.compare.desc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">{t("history.compare.col.kpi")}</TableHead>
                {entries.map((e, i) => (
                  <TableHead key={e.id} className="min-w-[180px]">
                    <div className="text-xs font-semibold text-foreground">
                      {i === 0 && <Badge variant="outline" className="mr-1">{t("history.compare.ref")}</Badge>}
                      {e.title}
                    </div>
                    <div className="text-[10px] font-normal text-muted-foreground">
                      {formatDateShort(e.created_at)}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {labels.map((label, rowIdx) => (
                <TableRow key={label}>
                  <TableCell className="font-medium text-muted-foreground">{label}</TableCell>
                  {entries.map((e, colIdx) => {
                    const k = kpiSets[colIdx][rowIdx];
                    const delta = computeDelta(rowIdx, colIdx);
                    return (
                      <TableCell key={e.id} className="tabular-nums">
                        <div className="font-semibold">{formatVal(k.value, k.unit)}</div>
                        {delta && (
                          <div
                            className={`text-[10px] ${
                              delta.startsWith("+") ? "text-warning-foreground" : "text-success-foreground"
                            }`}
                          >
                            {delta}
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
