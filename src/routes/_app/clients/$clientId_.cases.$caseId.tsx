// Page dossier : ouverte via "Ouvrir" depuis l'onglet "Dossiers" de la
// fiche client. C'est ICI, et seulement ici, qu'on lance un calculateur
// pré-rempli pour ce client — jamais depuis la fiche générale, qui ne
// garde que les informations (Synthèse, Fiscalité, Prévoyance, etc.).
// Un dossier terminé verrouille automatiquement les calculateurs (voir
// ClientCalculatorBar) : il faut le réouvrir pour relancer un calcul.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FolderOpen, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientCalculatorBar } from "@/components/clients/ClientCalculatorBar";
import { SessionSummaryTab } from "@/components/clients/SessionSummaryTab";
import { useSetClientCaseStatus, type ClientCase } from "@/hooks/useClientCases";
import type { Client } from "@/lib/clients/types";

export const Route = createFileRoute("/_app/clients/$clientId_/cases/$caseId")({
  head: () => ({ meta: [{ title: "Dossier · SwissBroker Pro" }] }),
  component: CaseDetailPage,
});

function CaseDetailPage() {
  const { clientId, caseId } = Route.useParams();
  const navigate = useNavigate();
  const setStatus = useSetClientCaseStatus(clientId);

  const { data, isLoading, error } = useQuery({
    queryKey: ["client-case-detail", clientId, caseId],
    queryFn: async () => {
      const [clientRes, caseRes] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).single(),
        supabase
          .from("client_cases")
          .select("*")
          .eq("id", caseId)
          .eq("client_id", clientId)
          .single(),
      ]);
      if (clientRes.error) throw clientRes.error;
      if (caseRes.error) throw caseRes.error;
      return {
        client: clientRes.data as Client,
        clientCase: caseRes.data as ClientCase,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-xl font-semibold">Dossier introuvable</h1>
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

  const { client, clientCase } = data;
  const open = clientCase.status === "open";

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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
              open ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
            }`}
          >
            <FolderOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              {clientCase.title}
              <Badge
                variant="secondary"
                className={open ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}
              >
                {open ? "Ouvert" : "Terminé"}
              </Badge>
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Créé le {new Date(clientCase.created_at).toLocaleDateString("fr-CH")}
              {clientCase.closed_at &&
                ` · Terminé le ${new Date(clientCase.closed_at).toLocaleDateString("fr-CH")}`}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={setStatus.isPending}
          onClick={() => setStatus.mutate({ caseId, status: open ? "closed" : "open" })}
        >
          {open ? "Terminer ce dossier" : "Réouvrir ce dossier"}
        </Button>
      </div>

      <div className="mt-6 space-y-4">
        <ClientCalculatorBar
          client={client}
          activeCaseId={caseId}
          onSelectCase={(id) =>
            id
              ? navigate({
                  to: "/clients/$clientId/cases/$caseId",
                  params: { clientId, caseId: id },
                })
              : navigate({
                  to: "/clients/$clientId",
                  params: { clientId },
                  search: { tab: "cases" },
                })
          }
          onCreateCase={(id) =>
            navigate({ to: "/clients/$clientId/cases/$caseId", params: { clientId, caseId: id } })
          }
        />
        <SessionSummaryTab
          clientId={clientId}
          clientName={`${client.first_name} ${client.last_name}`.trim()}
          caseId={caseId}
        />
      </div>
    </div>
  );
}
