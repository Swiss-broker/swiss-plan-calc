import { createFileRoute } from "@tanstack/react-router";
import { Calculator } from "lucide-react";

export const Route = createFileRoute("/_app/calculators")({
  head: () => ({ meta: [{ title: "Calculateurs rapides — SwissBroker Pro" }] }),
  component: CalculatorsPlaceholder,
});

function CalculatorsPlaceholder() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Calculateurs rapides</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Simulations sans dossier client : impôts, LPP, 3a, rente vs capital, comparateur
        cantonal.
      </p>
      <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
        <Calculator className="mx-auto h-8 w-8 text-primary" />
        <h3 className="mt-3 text-lg font-semibold">Moteur de calcul — en cours de construction</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Les calculateurs arrivent dans la phase 2 : impôts revenu/fortune (IFD + ICC tous
          cantons), impôt à la source A/B/C/H + frontaliers, rachat LPP, économie 3a,
          comparateur des 26 cantons.
        </p>
      </div>
    </div>
  );
}
