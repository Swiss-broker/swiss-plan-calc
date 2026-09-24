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

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/consolidated-benefits")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Prestations consolidées · SwissBroker Pro" }] }),
  component: ConsolidatedBenefitsCalc,
});

function ConsolidatedBenefitsCalc() {
  const { clientId } = Route.useSearch();
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

  return (
    <div className="space-y-6">
      <CalcCard className="bg-gradient-primary text-primary-foreground">
        <div className="flex items-start gap-3">
          <HeartHandshake className="mt-1 h-6 w-6" />
          <div>
            <h2 className="text-xl font-bold tracking-tight">Prestations consolidées</h2>
            <p className="mt-1 text-sm opacity-90">
              Ce que le dossier finance en cas de retraite, d'invalidité ou de décès, en réunissant 1er, 2e et 3e pilier — actuel vs optimisé.
            </p>
          </div>
        </div>
      </CalcCard>

      <CalcCard title="Client">
        <div className="max-w-sm space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Client</Label>
          <Select
            value={clientId ?? ""}
            onValueChange={(v) => navigate({ search: { clientId: v || undefined } })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionnez un client" />
            </SelectTrigger>
            <SelectContent>
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
          <ClientLinkBanner client={bundle.client} />
          <ConsolidatedBenefitsCard bundle={bundle} />
        </>
      )}
    </div>
  );
}
