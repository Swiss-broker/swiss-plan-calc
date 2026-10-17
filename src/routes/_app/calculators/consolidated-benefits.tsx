// Prestations consolidées (1er + 2e + 3e pilier) — calculateur dédié.
// Anciennement un onglet caché dans la fiche client ("Synthèse"), déplacé
// ici avec les autres calculateurs pour être accessible au même niveau que
// AVS/AI, LPP, 3a, etc. (voir audit : ce n'est pas une simulation what-if,
// mais une vue consolidée de résultats déjà calculés — elle a donc sa place
// parmi les calculateurs "Prévoyance", pas noyée dans les onglets de fiche.)
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useState } from "react";
import { HeartHandshake } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { CalcCard } from "@/components/calculators/CalcUI";
import { ConsolidatedBenefitsCard } from "@/components/clients/ConsolidatedBenefitsCard";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Client, ClientPension, ClientAssets } from "@/lib/clients/types";
import {
  GuideMode,
  GuideToggleButton,
  GuideSlot,
  type GuideStep,
} from "@/components/calculators/GuideMode";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
  caseId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/consolidated-benefits")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Prestations consolidées · SwissBroker Pro" }] }),
  component: ConsolidatedBenefitsCalc,
});

function ConsolidatedBenefitsCalc() {
  const { clientId, caseId } = Route.useSearch();
  const navigate = Route.useNavigate();

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-mini-consolidated"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name")
        .eq("archived", false)
        .order("last_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: bundle, isLoading } = useQuery({
    enabled: !!clientId,
    queryKey: ["client-bundle-consolidated-benefits", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const [c, p, a] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).single(),
        supabase.from("client_pension").select("*").eq("client_id", clientId).maybeSingle(),
        supabase.from("client_assets").select("*").eq("client_id", clientId).maybeSingle(),
      ]);
      if (c.error) throw c.error;
      return {
        client: c.data as Client,
        pension: (p.data ?? null) as ClientPension | null,
        assets: (a.data ?? null) as ClientAssets | null,
      };
    },
  });

  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    {
      title: "Bienvenue sur Prestations consolidées",
      body: "Cette page réunit en un seul endroit ce que le dossier finance pour le client en cas de retraite, d'invalidité ou de décès, en additionnant 1er pilier (AVS/AI), 2e pilier (LPP) et 3e pilier (3a). Ce n'est pas un nouveau calcul : c'est une vue consolidée des simulations déjà réalisées ailleurs.",
    },
    {
      title: "D'où viennent les chiffres « Actuel »",
      body: "La colonne « Actuel » reprend les dernières simulations AVS/AI, LPP et 3a réellement sauvegardées pour ce client DANS CE DOSSIER — jamais un recalcul indépendant, ni une simulation d'un autre dossier du même client. C'est exactement la même sélection que celle utilisée par le PDF de synthèse.",
    },
    {
      title: "Ce que représente « Optimisé »",
      body: "La colonne « Optimisé » n'est pas basée sur une simulation que vous auriez faite dans ce dossier : elle sature automatiquement la capacité de rachat LPP restante du client et porte le versement 3a au plafond légal salarié (si celui-ci est inférieur), puis projette le capital et les rentes obtenus — à comparer directement à la situation actuelle, sans optimisation.",
    },
    {
      title: "Trois volets : retraite, invalidité, décès",
      body: "Les onglets en haut de la carte permettent de voir ce que finance le dossier pour chacun des trois événements. Les montants changent d'un onglet à l'autre : une rente d'invalidité n'est pas une rente de retraite.",
    },
    {
      title: "Cohérence avec le PDF de synthèse",
      body: "Les chiffres affichés ici sont les mêmes que ceux de la page « Prestations consolidées » du PDF de synthèse du dossier. Si une nouvelle simulation AVS/AI, LPP ou 3a est sauvegardée dans ce dossier, revenez sur cette page pour voir l'effet sur la colonne « Actuel » avant de générer le PDF.",
    },
  ];

  return (
    <div className="space-y-6">
      <GuideMode
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        steps={guideSteps}
        title="Guide, Prestations consolidées"
        guideId="calc-consolidated-benefits"
      />
      <GuideSlot>
        <GuideToggleButton onClick={() => setGuideOpen(true)} />
      </GuideSlot>
      <CalcCard className="bg-gradient-primary text-primary-foreground">
        <div className="flex items-start gap-3">
          <HeartHandshake className="mt-1 h-6 w-6" />
          <div>
            <h2 className="text-xl font-bold tracking-tight">Prestations consolidées</h2>
            <p className="mt-1 text-sm opacity-90">
              Ce que le dossier finance en cas de retraite, d'invalidité ou de décès, en réunissant
              1er, 2e et 3e pilier (actuel vs optimisé).
            </p>
          </div>
        </div>
      </CalcCard>

      <CalcCard title="Client">
        <div className="max-w-sm space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Client</Label>
          <Select
            value={clientId ?? "none"}
            onValueChange={(v) => navigate({ search: { clientId: v === "none" ? undefined : v } })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionnez un client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sélectionnez un client</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.last_name} {c.first_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CalcCard>

      {!clientId ? (
        <CalcCard>
          <p className="text-sm text-muted-foreground">
            Sélectionnez un client ci-dessus (ou ouvrez cette page depuis l'onglet « Prévoyance » de sa fiche) pour voir ses prestations consolidées.
          </p>
        </CalcCard>
      ) : isLoading || !bundle ? (
        <CalcCard>
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </CalcCard>
      ) : (
        <>
          <ClientLinkBanner client={bundle.client} caseId={caseId} />
          <ConsolidatedBenefitsCard bundle={bundle} caseId={caseId} />
        </>
      )}
    </div>
  );
}
