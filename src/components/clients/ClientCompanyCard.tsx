import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, ExternalLink, Link2Off, Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LEGAL_FORM_LABELS, type Company } from "@/lib/companies/types";
import { toast } from "sonner";

interface ClientCompanyCardProps {
  clientId: string;
  companyId: string | null;
  companyRole: string | null;
}

export function ClientCompanyCard({ clientId, companyId, companyRole }: ClientCompanyCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [role, setRole] = useState(companyRole ?? "");

  const { data: company } = useQuery({
    queryKey: ["client-company", clientId, companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data as Company | null;
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-light", user?.id],
    enabled: !!user && pickerOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, legal_name, legal_form")
        .eq("archived", false)
        .order("legal_name");
      if (error) throw error;
      return data as Pick<Company, "id" | "legal_name" | "legal_form">[];
    },
  });

  const updateAttach = useMutation({
    mutationFn: async (newCompanyId: string | null) => {
      const { error } = await supabase
        .from("clients")
        .update({ company_id: newCompanyId })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rattachement mis à jour");
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["companies-directors-count"] });
      setPickerOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRole = useMutation({
    mutationFn: async (newRole: string) => {
      const { error } = await supabase
        .from("clients")
        .update({ company_role: newRole.trim() || null })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rôle mis à jour");
      qc.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold tracking-tight">Société</h3>
      </div>

      {companyId && company ? (
        <div className="mt-3 space-y-3">
          <div>
            <Link
              to="/companies/$companyId"
              params={{ companyId: companyId }}
              className="inline-flex items-center gap-1 text-base font-medium text-primary hover:underline"
            >
              {company.legal_name}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <p className="text-xs text-muted-foreground">
              {LEGAL_FORM_LABELS[company.legal_form]}
              {company.canton ? ` · ${company.canton}` : ""}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role-input" className="text-xs">
              Rôle dans la société
            </Label>
            <div className="flex gap-2">
              <Input
                id="role-input"
                list="role-suggestions"
                value={role}
                placeholder="Gérant, Administrateur…"
                onChange={(e) => setRole(e.target.value)}
                onBlur={() => {
                  if ((role.trim() || null) !== (companyRole ?? null)) {
                    updateRole.mutate(role);
                  }
                }}
                className="text-sm"
              />
              <datalist id="role-suggestions">
                <option value="Gérant" />
                <option value="Administrateur" />
                <option value="Président" />
                <option value="Associé" />
                <option value="Directeur" />
              </datalist>
            </div>
          </div>

          {/* Accès direct au comparateur rémunération dirigeant depuis la
              fiche du dirigeant lui-même — avant, il fallait passer par
              l'onglet "Calculs" générique (liste de tous les calculateurs)
              pour le retrouver, peu visible pour ce cas d'usage précis. */}
          <Button asChild size="sm" className="w-full gap-2">
            <Link to="/calculators/director-compensation" search={{ clientId, companyId }}>
              <TrendingUp className="h-3.5 w-3.5" />
              Comparateur rémunération dirigeant
            </Link>
          </Button>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPickerOpen(true)}
            >
              Modifier le rattachement
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => updateAttach.mutate(null)}
            >
              <Link2Off className="h-3.5 w-3.5" />
              Détacher
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            Aucune société rattachée. Rattachez ce client à une société existante ou créez-en une.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
              Rattacher à une société existante
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate({ to: "/companies/new" })}
            >
              <Plus className="h-3.5 w-3.5" />
              Créer une nouvelle société
            </Button>
          </div>
        </div>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rattacher à une société</DialogTitle>
            <DialogDescription>Choisissez parmi vos sociétés enregistrées.</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto rounded-md border border-border">
            {companies.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Aucune société enregistrée.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {companies.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/30"
                  >
                    <div>
                      <div className="text-sm font-medium">{c.legal_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {LEGAL_FORM_LABELS[c.legal_form]}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={c.id === companyId}
                      onClick={() => updateAttach.mutate(c.id)}
                    >
                      {c.id === companyId ? "Rattachée" : "Choisir"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
