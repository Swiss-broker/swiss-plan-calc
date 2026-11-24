import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Client } from "@/lib/clients/types";
import { toast } from "sonner";

interface AttachDirectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
}

export function AttachDirectorDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
}: AttachDirectorDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["unattached-clients", user?.id, showAll],
    enabled: !!user && open,
    queryFn: async () => {
      let q = supabase
        .from("clients")
        .select("*")
        .eq("broker_id", user!.id)
        .is("company_id", null)
        .eq("archived", false);
      if (!showAll) q = q.eq("work_status", "director");
      const { data, error } = await q.order("last_name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.first_name.toLowerCase().includes(q) ||
        c.last_name.toLowerCase().includes(q),
    );
  }, [clients, search]);

  const attach = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from("clients")
        .update({ company_id: companyId })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dirigeant rattaché");
      qc.invalidateQueries({ queryKey: ["company-directors", companyId] });
      qc.invalidateQueries({ queryKey: ["unattached-clients"] });
      qc.invalidateQueries({ queryKey: ["companies-directors-count"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Rattacher un dirigeant à {companyName}</DialogTitle>
          <DialogDescription>
            Sélectionnez le client à rattacher comme dirigeant de cette société.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-72 overflow-y-auto rounded-md border border-border">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {showAll
                ? "Aucun client disponible (tous déjà rattachés)."
                : "Aucun client avec statut Dirigeant de société disponible. Cochez la case ci-dessous pour élargir la recherche."}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {c.last_name.toUpperCase()} {c.first_name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.email ?? "—"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={attach.isPending}
                    onClick={() => attach.mutate(c.id)}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Rattacher
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-md bg-muted/30 p-3">
          <Checkbox
            id="show-all-clients"
            checked={showAll}
            onCheckedChange={(v) => setShowAll(v === true)}
          />
          <div className="space-y-0.5">
            <Label htmlFor="show-all-clients" className="cursor-pointer text-sm">
              Afficher tous mes clients
            </Label>
            <p className="text-xs text-muted-foreground">
              Permet de rattacher des actionnaires passifs, administrateurs externes, etc.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
