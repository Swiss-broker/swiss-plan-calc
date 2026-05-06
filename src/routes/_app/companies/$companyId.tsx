import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LEGAL_FORM_LABELS, type Company } from "@/lib/companies/types";
import { CANTON_BY_CODE } from "@/lib/swiss/cantons";

export const Route = createFileRoute("/_app/companies/$companyId")({
  head: () => ({ meta: [{ title: "Société · SwissBroker Pro" }] }),
  component: CompanyDetailPlaceholder,
});

function CompanyDetailPlaceholder() {
  const { companyId } = Route.useParams();
  const { data: company, isLoading } = useQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data as Company;
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/companies">
          <ArrowLeft className="h-4 w-4" /> Sociétés
        </Link>
      </Button>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Chargement…</div>
      ) : !company ? (
        <div className="text-sm text-muted-foreground">Société introuvable.</div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{company.legal_name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {LEGAL_FORM_LABELS[company.legal_form]}
                {company.canton
                  ? ` · ${company.canton} ${CANTON_BY_CODE[company.canton]?.name ?? ""}`
                  : ""}
                {company.founding_year ? ` · Fondée en ${company.founding_year}` : ""}
              </p>
              {company.ide_number ? (
                <p className="mt-1 text-xs text-muted-foreground">IDE : {company.ide_number}</p>
              ) : null}
            </div>
            <Button asChild variant="outline">
              <Link to="/companies/$companyId/edit" params={{ companyId }}>
                <Pencil className="h-4 w-4" /> Modifier
              </Link>
            </Button>
          </div>

          <div className="mt-8 rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              La fiche société complète (KPI, onglets, dirigeants) arrive en Phase 3.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
