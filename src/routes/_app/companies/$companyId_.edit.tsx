import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/companies/$companyId_/edit")({
  head: () => ({ meta: [{ title: "Modifier société · SwissBroker Pro" }] }),
  component: EditCompanyPlaceholder,
});

function EditCompanyPlaceholder() {
  const { companyId } = Route.useParams();
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight">Modifier la société</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Le formulaire d'édition arrive en Phase 2.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/companies/$companyId" params={{ companyId }}>
          <ArrowLeft className="h-4 w-4" /> Retour à la fiche
        </Link>
      </Button>
    </div>
  );
}
