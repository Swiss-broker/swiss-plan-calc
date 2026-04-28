import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_app/clients")({
  head: () => ({ meta: [{ title: "Clients — SwissBroker Pro" }] }),
  component: ClientsPlaceholder,
});

function ClientsPlaceholder() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Vos dossiers clients (identité, situation fiscale, prévoyance, patrimoine).
      </p>
      <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
        <Users className="mx-auto h-8 w-8 text-primary" />
        <h3 className="mt-3 text-lg font-semibold">Module clients — bientôt disponible</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          La création complète d'un dossier client (formulaire multi-étapes, fiche, onglets
          identité / fiscalité / prévoyance / patrimoine / scénarios) arrive dans la prochaine
          itération.
        </p>
      </div>
    </div>
  );
}
