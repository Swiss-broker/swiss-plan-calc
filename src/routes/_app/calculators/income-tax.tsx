import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/income-tax")({
  validateSearch: zodValidator(searchSchema),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/calculators/tax-global", search: search.clientId ? { clientId: search.clientId } : undefined });
  },
  component: () => null,
});
