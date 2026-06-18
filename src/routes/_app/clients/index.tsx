import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  Search,
  Trash2,
  Users,
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
import { toast } from "sonner";
import { CANTON_BY_CODE } from "@/lib/swiss/cantons";
import { TAX_STATUS_LABELS, CIVIL_STATUS_LABELS } from "@/lib/swiss/enums";
import { ageFromDob, type Client } from "@/lib/clients/types";
import { formatCHF } from "@/lib/format";
import { useT } from "@/contexts/LanguageContext";
import { tCanton } from "@/lib/i18n";

export const Route = createFileRoute("/_app/clients/")({
  head: () => ({ meta: [{ title: "Clients · SwissBroker Pro" }] }),
  component: ClientsListPage,
});

function ClientsListPage() {
  const t = useT();
  const { user } = useAuth();
  const { canAddClient, limits, plan } = usePlan();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", user?.id, filter],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("archived", filter === "archived")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Client[];
    },
  });

  const archive = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase.from("clients").update({ archived }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.archived ? t("clients.toast.archived") : t("clients.toast.restored"));
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Cleanup related rows (no FK cascade configured)
      await supabase.from("client_notes").delete().eq("client_id", id);
      await supabase.from("client_assets").delete().eq("client_id", id);
      await supabase.from("client_pension").delete().eq("client_id", id);
      await supabase.from("simulations").delete().eq("client_id", id);
      await supabase.from("scenarios").delete().eq("client_id", id);
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("clients.toast.deleted"));
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = clients.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.first_name.toLowerCase().includes(q) ||
      c.last_name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.commune ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("clients.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("clients.subtitle")}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            onClick={() => {
              if (!canAddClient(clients.filter(c => !c.archived).length)) return;
              navigate({ to: "/clients/new" });
            }}
            disabled={!canAddClient(clients.filter(c => !c.archived).length)}
            className="shadow-elegant"
          >
            <PlusCircle className="h-4 w-4" />
            {t("clients.new")}
          </Button>
          {limits.maxClients !== null && (
            <span className="text-xs text-muted-foreground">
              {clients.filter(c => !c.archived).length} / {limits.maxClients} clients
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("clients.search.placeholder")}
            className="pl-9"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "active" | "archived")}>
          <TabsList>
            <TabsTrigger value="active">{t("clients.tab.active")}</TabsTrigger>
            <TabsTrigger value="archived">{t("clients.tab.archived")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card shadow-card">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => { if (canAddClient(0)) navigate({ to: "/clients/new" }); }} hasSearch={!!search} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("clients.col.name")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("clients.col.civil_status")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("clients.col.canton")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("clients.col.tax_status")}</TableHead>
                <TableHead className="hidden lg:table-cell text-right">{t("clients.col.gross")}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const age = ageFromDob(c.date_of_birth);
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => navigate({ to: "/clients/$clientId", params: { clientId: c.id } })}
                  >
                    <TableCell>
                      <div className="font-medium">
                        {c.last_name.toUpperCase()} {c.first_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {age !== null ? t("clients.row.years", { n: age }) : "—"}
                        {c.email ? ` · ${c.email}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {CIVIL_STATUS_LABELS[c.civil_status]}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {c.canton ? `${c.canton} · ${tCanton(c.canton) || CANTON_BY_CODE[c.canton]?.name || ""}` : "—"}
                      {c.commune ? <div className="text-xs">{c.commune}</div> : null}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="secondary" className="font-normal">
                        {TAX_STATUS_LABELS[c.tax_status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-sm tabular-nums">
                      {formatCHF(c.gross_annual_salary)}
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
                                to: "/clients/$clientId/edit",
                                params: { clientId: c.id },
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
            <AlertDialogTitle>{t("clients.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("clients.delete.desc", {
                name: `${pendingDelete?.first_name ?? ""} ${pendingDelete?.last_name ?? ""}`.trim(),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("clients.delete.confirm")}
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
      <Users className="mx-auto h-8 w-8 text-primary" />
      <h3 className="mt-3 text-lg font-semibold">
        {hasSearch ? t("clients.empty.searching") : t("clients.empty.title")}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {hasSearch ? t("clients.empty.search.desc") : t("clients.empty.desc")}
      </p>
      {!hasSearch && (
        <Button className="mt-4" onClick={onCreate}>
          <PlusCircle className="h-4 w-4" /> {t("clients.empty.cta")}
        </Button>
      )}
    </div>
  );
}

// Re-export pour usage cross-module
export type { Client };
