// Page du dossier virtuel "Historique (avant dossiers)" : simulations
// enregistrées avant l'introduction des dossiers (case_id NULL). Ce n'est
// pas un vrai dossier (aucune ligne client_cases), donc pas de statut, pas
// de ClientCalculatorBar — on ne relance pas de calcul ici, seulement
// consultation/suppression des simulations historiques. Voir "Ouvrir" sur
// le bloc "Historique" dans ClientCasesTab et SessionSummaryTab.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SessionSummaryTab } from "@/components/clients/SessionSummaryTab";
import type { Client } from "@/lib/clients/types";

export const Route = createFileRoute("/_app/clients/$clientId_/cases/historique")({
  head: () => ({ meta: [{ title: "Historique · SwissBroker Pro" }] }),
  component: HistoriquePage,
});

function HistoriquePage() {
  const { clientId } = Route.useParams();

  const {
    data: client,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();
      if (error) throw error;
      return data as Client;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !client) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-xl font-semibold">Client introuvable</h1>
        <Link
          to="/clients/$clientId"
          params={{ clientId }}
          search={{ tab: "cases" }}
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          Retour à la fiche client
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        to="/clients/$clientId"
        params={{ clientId }}
        search={{ tab: "cases" }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {client.last_name.toUpperCase()} {client.first_name}
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Historique (avant dossiers)</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Simulations enregistrées avant l'introduction des dossiers. Consultation uniquement :
            pour lancer un nouveau calcul, ouvrez ou créez un dossier.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <SessionSummaryTab
          clientId={clientId}
          clientName={`${client.first_name} ${client.last_name}`.trim()}
          historique
        />
      </div>
    </div>
  );
}
