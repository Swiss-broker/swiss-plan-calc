import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ClientWizard } from "@/components/clients/ClientWizard";
import type { Client, ClientPension, ClientAssets } from "@/lib/clients/types";

export const Route = createFileRoute("/_app/clients/$clientId_/edit")({
  head: () => ({ meta: [{ title: "Modifier client · SwissBroker Pro" }] }),
  component: EditClientPage,
});

function EditClientPage() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["client-edit", clientId],
    queryFn: async () => {
      const [clientRes, pensionRes, assetsRes] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).single(),
        supabase.from("client_pension").select("*").eq("client_id", clientId).maybeSingle(),
        supabase.from("client_assets").select("*").eq("client_id", clientId).maybeSingle(),
      ]);
      if (clientRes.error) throw clientRes.error;
      return {
        client: clientRes.data as Client,
        pension: (pensionRes.data ?? undefined) as ClientPension | undefined,
        assets: (assetsRes.data ?? undefined) as ClientAssets | undefined,
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
        <h1 className="text-xl font-semibold">Client introuvable</h1>
        <button
          onClick={() => navigate({ to: "/clients" })}
          className="mt-4 text-sm text-primary hover:underline"
        >
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <ClientWizard
      mode="edit"
      clientId={clientId}
      initial={{
        client: data.client,
        pension: data.pension
          ? {
              lpp_current_balance: Number(data.pension.lpp_current_balance),
              lpp_insured_salary: Number(data.pension.lpp_insured_salary),
              lpp_max_buyback: Number(data.pension.lpp_max_buyback),
              lpp_plan: data.pension.lpp_plan,
              pillar_3a_annual_contribution: Number(data.pension.pillar_3a_annual_contribution),
              pillar_3a_accounts: Array.isArray(data.pension.pillar_3a_accounts)
                ? (data.pension.pillar_3a_accounts as unknown as { institution: string; balance: number }[])
                : [],
              vested_benefits_accounts: Array.isArray(data.pension.vested_benefits_accounts)
                ? (data.pension.vested_benefits_accounts as unknown as { institution: string; balance: number }[])
                : [],
            }
          : undefined,
        assets: data.assets
          ? {
              bank_accounts: Number(data.assets.bank_accounts),
              securities: Number(data.assets.securities),
              real_estate_value: Number(data.assets.real_estate_value),
              mortgage_debt: Number(data.assets.mortgage_debt),
            }
          : undefined,
      }}
    />
  );
}
