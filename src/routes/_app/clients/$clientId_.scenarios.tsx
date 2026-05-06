import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, GitCompare, Loader2, Sparkles, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CANTON_BY_CODE } from "@/lib/swiss/cantons";
import { computeIncomeTax } from "@/lib/tax/income";
import { formatCHF, formatPct } from "@/lib/format";
import {
  SCENARIO_PRESETS,
  SCENARIO_BY_ID,
  CATEGORY_LABELS,
  clientToTaxInput,
  type ScenarioId,
  type ScenarioDef,
} from "@/lib/scenarios/presets";
import type { Client, ClientPension, ClientAssets } from "@/lib/clients/types";

export const Route = createFileRoute("/_app/clients/$clientId_/scenarios")({
  head: () => ({ meta: [{ title: "Comparateur de scénarios · SwissBroker Pro" }] }),
  component: ScenariosPage,
});

function ScenariosPage() {
  const { clientId } = Route.useParams();
  const [selected, setSelected] = useState<ScenarioId[]>(["baseline", "max_3a", "move_zg"]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["client-full", clientId],
    queryFn: async () => {
      const [c, p, a] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).single(),
        supabase.from("client_pension").select("*").eq("client_id", clientId).maybeSingle(),
        supabase.from("client_assets").select("*").eq("client_id", clientId).maybeSingle(),
      ]);
      if (c.error) throw c.error;
      return {
        client: c.data as Client,
        pension: p.data as ClientPension | null,
        assets: a.data as ClientAssets | null,
      };
    },
  });

  const baseline = useMemo(
    () => (data ? clientToTaxInput(data.client, data.pension, data.assets) : null),
    [data],
  );

  const lppCapacity = Number(data?.pension?.lpp_max_buyback ?? 0);

  const computed = useMemo(() => {
    if (!baseline) return [];
    return selected.map((id) => {
      const def = SCENARIO_BY_ID[id];
      let input = def.apply(baseline);
      if (id === "lpp_buyback_full" && lppCapacity > 0) {
        input = { ...input, lppBuyback: lppCapacity };
      }
      const result = computeIncomeTax(input);
      return { id, def, input, result };
    });
  }, [baseline, selected, lppCapacity]);

  const referenceTax = computed[0]?.result.totalTax ?? 0;

  const toggle = (id: ScenarioId) => {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 4) return [...cur.slice(1), id];
      return [...cur, id];
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data || !baseline) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-xl font-semibold">Impossible de charger le dossier</h1>
        <Link to="/clients" className="mt-4 inline-block text-sm text-primary hover:underline">
          Retour
        </Link>
      </div>
    );
  }

  const grouped = SCENARIO_PRESETS.reduce<Record<string, ScenarioDef[]>>((acc, s) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          to="/clients/$clientId"
          params={{ clientId }}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {data.client.last_name.toUpperCase()}{" "}
          {data.client.first_name}
        </Link>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <GitCompare className="h-7 w-7 text-primary" />
            Comparateur de scénarios
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sélectionnez jusqu'à 4 scénarios pour comparer impôts, taux et prévoyance côte à côte.
          </p>
        </div>
        <Badge variant="secondary" className="self-start sm:self-auto">
          {selected.length}/4 sélectionnés
        </Badge>
      </div>

      {/* Sélecteur */}
      <Card className="mt-6" tilt={false}>
        <CardHeader>
          <CardTitle className="text-base">Choisir des scénarios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {CATEGORY_LABELS[cat as ScenarioDef["category"]]}
              </div>
              <div className="flex flex-wrap gap-2">
                {list.map((s) => {
                  const active = selected.includes(s.id);
                  const disabled =
                    s.id === "lpp_buyback_full" && lppCapacity <= 0;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(s.id)}
                      title={disabled ? "Aucune capacité de rachat LPP enregistrée" : s.description}
                      className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                        active
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-card hover:border-primary/40 hover:bg-accent"
                      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      {active && <Check className="h-3 w-3" />}
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tableau comparatif */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Indicateur</th>
              {computed.map((c, i) => (
                <th key={c.id} className="px-4 py-3 text-right font-semibold">
                  <div className="flex flex-col items-end">
                    <span className="inline-flex items-center gap-1">
                      {i === 0 && <Sparkles className="h-3 w-3 text-primary" />}
                      {c.def.label}
                    </span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {CANTON_BY_CODE[c.input.canton]?.code ?? c.input.canton}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <Row label="Revenu brut" cells={computed.map((c) => formatCHF(c.result.grossIncome))} />
            <Row
              label="Revenu imposable"
              cells={computed.map((c) => formatCHF(c.result.taxableIncomeCC))}
            />
            <Row
              label="Impôt fédéral (IFD)"
              cells={computed.map((c) => formatCHF(c.result.ifd))}
            />
            <Row label="Cantonal" cells={computed.map((c) => formatCHF(c.result.cantonal))} />
            <Row label="Communal" cells={computed.map((c) => formatCHF(c.result.communal))} />
            <Row label="Paroissial" cells={computed.map((c) => formatCHF(c.result.church))} />
            <Row label="Fortune" cells={computed.map((c) => formatCHF(c.result.wealthTax))} />
            <tr className="bg-muted/30 font-semibold">
              <td className="px-4 py-3 text-left">Impôt total</td>
              {computed.map((c) => (
                <td key={c.id} className="px-4 py-3 text-right tabular-nums">
                  {formatCHF(c.result.totalTax)}
                </td>
              ))}
            </tr>
            <Row
              label="Taux effectif"
              cells={computed.map((c) => formatPct(c.result.effectiveRate))}
            />
            <Row
              label="Taux marginal"
              cells={computed.map((c) => formatPct(c.result.marginalRate))}
            />
            <tr className="bg-primary/5">
              <td className="px-4 py-3 text-left font-semibold">
                Δ vs {computed[0]?.def.label}
              </td>
              {computed.map((c, i) => {
                const delta = c.result.totalTax - referenceTax;
                const positive = delta > 0;
                return (
                  <td
                    key={c.id}
                    className={`px-4 py-3 text-right font-semibold tabular-nums ${
                      i === 0
                        ? "text-muted-foreground"
                        : positive
                          ? "text-destructive"
                          : "text-success"
                    }`}
                  >
                    {i === 0
                      ? "—"
                      : `${positive ? "+" : ""}${formatCHF(delta)}`}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Détails des hypothèses */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {computed.map((c) => (
          <Card key={c.id} tilt={false}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{c.def.label}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              <p className="leading-relaxed">{c.def.description}</p>
              <dl className="mt-3 space-y-1">
                <Mini label="Statut" value={c.input.status} />
                <Mini label="Enfants" value={String(c.input.children ?? 0)} />
                <Mini label="Salaire" value={formatCHF(c.input.grossSalary)} />
                <Mini label="3a" value={formatCHF(c.input.pillar3aContributions ?? 0)} />
                {(c.input.lppBuyback ?? 0) > 0 && (
                  <Mini label="Rachat LPP" value={formatCHF(c.input.lppBuyback ?? 0)} />
                )}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Link to="/clients/$clientId" params={{ clientId }}>
          <Button variant="outline">Retour à la fiche</Button>
        </Link>
      </div>
    </div>
  );
}

function Row({ label, cells }: { label: string; cells: string[] }) {
  return (
    <tr>
      <td className="px-4 py-2.5 text-left text-muted-foreground">{label}</td>
      {cells.map((v, i) => (
        <td key={i} className="px-4 py-2.5 text-right tabular-nums">
          {v}
        </td>
      ))}
    </tr>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
