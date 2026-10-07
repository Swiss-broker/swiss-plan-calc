import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
  caseId: fallback(z.string().uuid().optional(), undefined),
  simId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/income-tax")({
  validateSearch: zodValidator(searchSchema),
  beforeLoad: ({ search }) => {
    // Route legacy, remplacée par le calculateur unifié Fiscal Global. On
    // transmet clientId/caseId/simId tels quels : sans ça, rouvrir une
    // simulation "income_tax" sauvegardée (via KIND_ROUTES) perdait son
    // simId en route et rouvrait un formulaire vierge au lieu du brouillon.
    throw redirect({
      to: "/calculators/tax-global",
      search: { clientId: search.clientId, caseId: search.caseId, simId: search.simId },
    });
  },
  component: () => null,
});
