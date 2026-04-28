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

export const Route = createFileRoute("/_app/clients/")({
  head: () => ({ meta: [{ title: "Clients — SwissBroker Pro" }] }),
  component: ClientsListPage,
});

function ClientsListPage() {
  const { user } = useAuth();
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
      toast.success(vars.archived ? "Client archivé" : "Client restauré");
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
      toast.success("Client supprimé");
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
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez vos dossiers : identité, fiscalité, prévoyance, patrimoine.
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/clients/new" })} className="shadow-elegant">
          <PlusCircle className="h-4 w-4" />
          Nouveau client
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email, commune…"
            className="pl-9"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "active" | "archived")}>
          <TabsList>
            <TabsTrigger value="active">Actifs</TabsTrigger>
            <TabsTrigger value="archived">Archivés</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card shadow-card">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => navigate({ to: "/clients/new" })} hasSearch={!!search} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="hidden md:table-cell">État civil</TableHead>
                <TableHead className="hidden lg:table-cell">Canton / Commune</TableHead>
                <TableHead className="hidden md:table-cell">Statut fiscal</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Revenu brut</TableHead>
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
                        {age !== null ? `${age} ans` : "—"}
                        {c.email ? ` · ${c.email}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {CIVIL_STATUS_LABELS[c.civil_status]}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {c.canton ? `${c.canton} — ${CANTON_BY_CODE[c.canton]?.name ?? ""}` : "—"}
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
                            <Pencil className="h-4 w-4" /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => archive.mutate({ id: c.id, archived: !c.archived })}
                          >
                            {c.archived ? (
                              <>
                                <ArchiveRestore className="h-4 w-4" /> Restaurer
                              </>
                            ) : (
                              <>
                                <Archive className="h-4 w-4" /> Archiver
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setPendingDelete(c)}
                          >
                            <Trash2 className="h-4 w-4" /> Supprimer
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
            <AlertDialogTitle>Supprimer ce dossier ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Toutes les données (prévoyance, patrimoine,
              scénarios, notes) liées à{" "}
              <strong>
                {pendingDelete?.first_name} {pendingDelete?.last_name}
              </strong>{" "}
              seront supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ onCreate, hasSearch }: { onCreate: () => void; hasSearch: boolean }) {
  return (
    <div className="p-12 text-center">
      <Users className="mx-auto h-8 w-8 text-primary" />
      <h3 className="mt-3 text-lg font-semibold">
        {hasSearch ? "Aucun client trouvé" : "Aucun dossier client"}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {hasSearch
          ? "Essayez d'élargir votre recherche."
          : "Créez votre premier dossier pour démarrer simulations et optimisations."}
      </p>
      {!hasSearch && (
        <Button className="mt-4" onClick={onCreate}>
          <PlusCircle className="h-4 w-4" /> Créer un client
        </Button>
      )}
    </div>
  );
}

// Re-export pour usage cross-module
export type { Client };
