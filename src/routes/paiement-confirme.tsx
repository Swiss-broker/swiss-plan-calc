// src/routes/paiement-confirme.tsx
// Page neutre de succès pour les offres commerciales générées via
// generate-offer (panel admin/commercial) — remplacée par la vraie page
// d'onboarding au Prompt 11. Aucune action, aucun lien vers un espace
// existant : le client n'a pas encore de compte à ce stade.
import { createFileRoute } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";

export const Route = createFileRoute("/paiement-confirme")({
  head: () => ({ meta: [{ title: "Paiement confirmé" }] }),
  component: PaiementConfirmePage,
});

function PaiementConfirmePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-hero flex items-center justify-center px-4">
      <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Merci !</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vérifiez votre boîte mail pour finaliser la création de votre compte.
        </p>
      </div>
    </div>
  );
}
