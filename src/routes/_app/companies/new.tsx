import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/companies/new")({
  head: () => ({ meta: [{ title: "Nouvelle société · SwissBroker Pro" }] }),
  component: NewCompanyPlaceholder,
});

function NewCompanyPlaceholder() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight">Création d'une société</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Le formulaire de création arrive en Phase 2.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/companies">
          <ArrowLeft className="h-4 w-4" /> Retour à la liste
        </Link>
      </Button>
    </div>
  );
}
