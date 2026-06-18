import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Building2,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  Search,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/contexts/PlanContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CANTON_BY_CODE } from "@/lib/swiss/cantons";
import {
  LEGAL_FORM_LABELS,
  LEGAL_FORM_OPTIONS,
  type Company,
  type LegalForm,
} from "@/lib/companies/types";
import { useT } from "@/contexts/LanguageContext";
import { tCanton } from "@/lib/i18n";

export const Route = createFileRoute("/_app/companies/")({
  head: () => ({ meta: [{ title: "Sociétés · SwissBroker Pro" }] }),
  component: CompaniesListPage,
});

function CompaniesListPage() {
  const t = useT();
  const { user } = useAuth();
  const { canAddCompany, limits } = usePlan();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const [formFilter, setFormFilter] = useState<LegalForm | "all">("all");
  const [pendingDelete, setPendingDelete] = useState<Company | null>(null);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies", user?.id, filter],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("archived", filter === "archived")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Company[];
    },
  });

  // Compteur dirigeants rattachés (par société)
  const { data: directorsCount = {} } = useQuery({
    queryKey: ["companies-directors-count", user?.id, companies.map((c) => c.id).join(",")],
    enabled: !!user && companies.length > 0,
    queryFn: async () => {
      const ids = companies.map((c) => c.id);
      const { data, error } = await supabase
        .from("clients")
        .select("company_id")
        .in("company_id", ids);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        const id = (row as { company_id: string | null }).company_id;
        if (id) map[id] = (map[id] ?? 0) + 1;
      }
      return map;
    },
  });

  const archive = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase.from("companies").update({ archived }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.archived ? t("companies.toast.archived") : t("companies.toast.restored"));
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // FK ON DELETE SET NULL gère le détachement des clients automatiquement.
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("companies.toast.deleted"));
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = companies.filter((c) => {
    if (formFilter !== "all" && c.legal_form !== formFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.legal_name.toLowerCase().includes(q) ||
      (c.ide_number ?? "").toLowerCase().includes(q) ||
      (c.canton ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("companies.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("companies.subtitle")}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            onClick={() => {
              if (!canAddCompany(companies.filter((c: {archived?: boolean}) => !c.archived).length)) return;
              navigate({ to: "/companies/new" });
            }}
            disabled={!canAddCompany(companies.filter((c: {archived?: boolean}) => !c.archived).length)}
            className="shadow-elegant"
          >
            <PlusCircle className="h-4 w-4" />
            {t("companies.new")}
          </Button>
          {limits.maxCompanies !== null && (
            <span className="text-xs text-muted-foreground">
              {companies.filter((c: {archived?: boolean}) => !c.archived).length} / {limits.maxCompanies} sociétés
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("companies.search.placeholder")}
              className="pl-9"
            />
          </div>
          <Select value={formFilter} onValueChange={(v) => setFormFilter(v as LegalForm | "all")}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("companies.filter.all_forms")}</SelectItem>
              {LEGAL_FORM_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "active" | "archived")}>
          <TabsList>
            <TabsTrigger value="active">{t("companies.tab.active")}</TabsTrigger>
            <TabsTrigger value="archived">{t("companies.tab.archived")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card shadow-card">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            onCreate={() => { if (canAddCompany(companies.filter((c: {archived?: boolean}) => !c.archived).length)) navigate({ to: "/companies/new" }); }}
            hasSearch={!!search || formFilter !== "all"}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("companies.col.legal_name")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("companies.col.form")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("companies.col.canton")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("companies.col.directors")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("companies.col.year")}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const count = directorsCount[c.id] ?? 0;
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate({ to: "/companies/$companyId", params: { companyId: c.id } })
                    }
                  >
                    <TableCell>
                      <div className="font-medium">{c.legal_name}</div>
                      {c.ide_number ? (
                        <div className="text-xs text-muted-foreground">{c.ide_number}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="secondary" className="font-normal">
                        {LEGAL_FORM_LABELS[c.legal_form]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {c.canton
                        ? `${c.canton} · ${tCanton(c.canton) || CANTON_BY_CODE[c.canton]?.name || ""}`
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant={count > 0 ? "default" : "outline"} className="font-normal">
                        {count}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground tabular-nums">
                      {c.founding_year ?? "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() =>
                              navigate({
                                to: "/companies/$companyId/edit",
                                params: { companyId: c.id },
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" /> {t("clients.action.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => archive.mutate({ id: c.id, archived: !c.archived })}
                          >
                            {c.archived ? (
                              <>
                                <ArchiveRestore className="h-4 w-4" /> {t("clients.action.restore")}
                              </>
                            ) : (
                              <>
                                <Archive className="h-4 w-4" /> {t("clients.action.archive")}
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setPendingDelete(c)}
                          >
                            <Trash2 className="h-4 w-4" /> {t("clients.action.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("companies.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("companies.delete.desc", { name: pendingDelete?.legal_name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("companies.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ onCreate, hasSearch }: { onCreate: () => void; hasSearch: boolean }) {
  const t = useT();
  return (
    <div className="p-12 text-center">
      <Building2 className="mx-auto h-8 w-8 text-primary" />
      <h3 className="mt-3 text-lg font-semibold">
        {hasSearch ? t("companies.empty.searching") : t("companies.empty.title")}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {hasSearch ? t("companies.empty.search.desc") : t("companies.empty.desc")}
      </p>
      {!hasSearch && (
        <Button className="mt-4" onClick={onCreate}>
          <PlusCircle className="h-4 w-4" /> {t("companies.empty.cta")}
        </Button>
      )}
    </div>
  );
}
