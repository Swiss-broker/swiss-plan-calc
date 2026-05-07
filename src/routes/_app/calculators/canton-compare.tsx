import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { Info, Sparkles } from "lucide-react";
import { NumField as BaseNumField } from "@/components/ui/num-field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getComparableCantons,
  getSelectableCantons,
  type SelectableCantonCode,
} from "@/lib/swiss/cantons";
import { computeIncomeTax, type IncomeTaxInput } from "@/lib/tax/income";
import { capitalWithdrawalTax } from "@/lib/lpp";
import { CalcCard } from "@/components/calculators/CalcUI";
import { formatCHF } from "@/lib/format";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { exportCantonComparePdf } from "@/lib/pdf/reports";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useAuth } from "@/contexts/AuthContext";
import { useClientDashboard } from "@/hooks/use-client-dashboard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Client,
  ClientPension,
  ClientAssets,
} from "@/lib/clients/types";

const ZG_CODE = "ZG";

import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { WikiTip } from "@/components/calculators/WikiTip";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/canton-compare")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Comparateur cantonal · SwissBroker Pro" }] }),
  component: CantonCompareCalc,
});

type Row = {
  code: string;
  name: string;
  total: number;
  effective: number;
  isReference: boolean;
  isSeparator?: boolean;
};

type CompareMode = "annual" | "lump_sum";

function CantonCompareCalc() {
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "canton-compare");
  const selectable = getSelectableCantons();
  const comparable = getComparableCantons();

  // Charge le bundle complet (pension + assets) pour calculer le capital LPP
  // projeté à 65 ans. Uniquement quand un client est sélectionné.
  const { data: bundle } = useQuery({
    enabled: !!clientId,
    queryKey: ["client-bundle-canton-compare", clientId],
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
  const dashboard = useClientDashboard(bundle ?? null);

  const [form, setForm] = useState({
    grossSalary: 120_000,
    spouseGrossSalary: 0,
    status: "single" as IncomeTaxInput["status"],
    children: 0,
    netWealth: 0,
    referenceCanton: "VD" as SelectableCantonCode,
  });
  useHydrateFormFromPrefill(prefill as Partial<typeof form> | null, setForm);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [mode, setMode] = useState<CompareMode>("annual");
  const projectedLPPCapital = dashboard?.lpp?.projectedCapitalAt65 ?? 0;
  const lumpSumStatus: "single" | "married" | "single_with_children" =
    form.status === "married"
      ? "married"
      : form.status === "single_with_children"
        ? "single_with_children"
        : "single";

  const data = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    for (const c of comparable) {
      try {
        if (mode === "annual") {
          const r = computeIncomeTax({
            canton: c.code,
            status: form.status,
            children: form.children,
            grossSalary: form.grossSalary,
            spouseGrossSalary: form.spouseGrossSalary,
            netWealth: form.netWealth,
          });
          rows.push({
            code: c.code,
            name: c.name,
            total: r.totalTax,
            effective: r.effectiveRate,
            isReference: c.code === ZG_CODE,
          });
        } else {
          // Mode prestation LPP en capital à la retraite
          const t = capitalWithdrawalTax({
            capital: projectedLPPCapital,
            canton: c.code,
            status: lumpSumStatus,
          });
          const effective =
            projectedLPPCapital > 0
              ? Math.round((t.total / projectedLPPCapital) * 1000) / 10
              : 0;
          rows.push({
            code: c.code,
            name: c.name,
            total: t.total,
            effective,
            isReference: c.code === ZG_CODE,
          });
        }
      } catch (e) {
        // Garde-fou : un canton comparable mais sans barème complet
        // ne casse pas tout le ranking (warn console seulement).
        console.warn(`[canton-compare] Calcul ignoré pour ${c.code}`, e);
      }
    }
    // Romands triés par charge fiscale, ZG toujours en bas (référence)
    const romands = rows.filter((r) => r.code !== ZG_CODE).sort((a, b) => a.total - b.total);
    const zg = rows.filter((r) => r.code === ZG_CODE);
    return [...romands, ...zg];
  }, [form, comparable, mode, projectedLPPCapital, lumpSumStatus]);

  const referenceTax = data.find((d) => d.code === form.referenceCanton)?.total ?? 0;
  const cheapestRomand = useMemo(
    () =>
      data
        .filter((d) => d.code !== ZG_CODE)
        .reduce<Row | null>((acc, r) => (!acc || r.total < acc.total ? r : acc), null),
    [data],
  );
  const romandsCount = data.filter((d) => d.code !== ZG_CODE).length;
  const hasZG = data.some((d) => d.code === ZG_CODE);

  const { user } = useAuth();
  const handleExport = () =>
    exportCantonComparePdf({
      header: { brokerEmail: user?.email ?? undefined },
      input: form,
      rows: data,
    });
  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: "Bienvenue", body: "Compare la charge fiscale entre cantons pour un même profil." },
    { title: "Paramètres", body: "Saisissez votre situation civile, revenu et déductions. Le calculateur compare les 26 cantons." },
    { title: "Multiplicateur", body: "Calcul effectué sur le chef-lieu de chaque canton (commune-précise viendra dans une prochaine version)." }
  ];



  return (
    <div className="space-y-6">
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title="Guide comparateur cantonal" />
      <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>


      {client && <ClientLinkBanner client={client} />}

      {clientId && (
        <CalcCard title="Mode de comparaison">
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as CompareMode)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <label
              htmlFor="mode-annual"
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <RadioGroupItem id="mode-annual" value="annual" className="mt-1" />
              <div>
                <div className="text-sm font-medium">Charge fiscale annuelle</div>
                <div className="text-xs text-muted-foreground">
                  Situation actuelle : revenu et fortune renseignés.
                </div>
              </div>
            </label>
            <label
              htmlFor="mode-lump-sum"
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5 aria-disabled:opacity-50"
              aria-disabled={projectedLPPCapital <= 0}
            >
              <RadioGroupItem
                id="mode-lump-sum"
                value="lump_sum"
                className="mt-1"
                disabled={projectedLPPCapital <= 0}
              />
              <div>
                <div className="text-sm font-medium">Impôt prestation LPP à la retraite</div>
                <div className="text-xs text-muted-foreground">
                  {projectedLPPCapital > 0
                    ? `Capital projeté à 65 ans : ${formatCHF(projectedLPPCapital)}`
                    : "Capital LPP projeté indisponible (renseigner LPP dans la fiche)."}
                </div>
              </div>
            </label>
          </RadioGroup>
        </CalcCard>
      )}

      <CalcCard
        title="Profil à comparer"
        description={
          mode === "lump_sum"
            ? `Impôt unique sur prestation en capital de ${formatCHF(projectedLPPCapital)} (1/5 du barème fédéral + cantonal).`
            : "Charge fiscale annuelle simulée pour le profil renseigné."
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumField label="Salaire brut (CHF)" value={form.grossSalary} onChange={(v) => set("grossSalary", v)} wikiId="ifd-icc" wikiTip="Salaire annuel brut soumis au barème cantonal et IFD." />
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span>Situation civile</span>
              <WikiTip articleId="ifd-icc" tip="Marié = splitting partiel (barème plus favorable). Famille monoparentale = barème spécial." />
            </Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as IncomeTaxInput["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Célibataire</SelectItem>
                <SelectItem value="married">Marié·e</SelectItem>
                <SelectItem value="single_with_children">Famille monoparentale</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.status === "married" && (
            <NumField label="Salaire brut conjoint (CHF)" value={form.spouseGrossSalary} onChange={(v) => set("spouseGrossSalary", v)} wikiId="ifd-icc" wikiTip="Marié = imposition commune. Le revenu du conjoint compte dans le barème." />
          )}
          <NumField label="Nombre d'enfants" value={form.children} onChange={(v) => set("children", v)} />
          <NumField label="Fortune nette (CHF)" value={form.netWealth} onChange={(v) => set("netWealth", v)} wikiId="fortune" wikiTip="Fortune imposable cantonale. Avoirs LPP / 3a exonérés tant que non retirés." />
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Canton de référence</Label>
            <Select
              value={form.referenceCanton}
              onValueChange={(v) => set("referenceCanton", v as SelectableCantonCode)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {selectable.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CalcCard>

      {/* Encart roadmap — au-dessus du graphique */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-muted-foreground">
          Comparaison sur les <strong className="text-foreground">6 cantons romands</strong> (GE, VD, VS, FR, NE, JU)
          {" + "}<strong className="text-foreground">Zoug</strong> à titre de référence fiscale.
          {" "}19 autres cantons disponibles prochainement (ZH, BS, BE, SZ, …).
        </p>
      </div>

      <CalcCard title="Classement par charge fiscale totale">
        <div className="h-[520px] w-full chart-rise">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 12, right: 32, top: 8, bottom: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <YAxis
                type="category"
                dataKey="code"
                width={56}
                tick={{ fontSize: 11, fill: "var(--foreground)" }}
              />
              <Tooltip
                allowEscapeViewBox={{ x: false, y: false }}
                wrapperStyle={{ maxWidth: 280, zIndex: 50 }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  maxWidth: 280,
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                }}
                itemStyle={{ whiteSpace: "normal" }}
                labelStyle={{ whiteSpace: "normal" }}
                formatter={(v: number, _: string, props) => {
                  const isZG = props.payload.code === ZG_CODE;
                  const label = isZG
                    ? `${props.payload.name} · ${props.payload.effective}% · Hors Suisse romande.`
                    : `${props.payload.name} · ${props.payload.effective}%`;
                  return [formatCHF(v), label];
                }}
              />
              <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                {data.map((d) => {
                  const isCheapest = cheapestRomand?.code === d.code;
                  const isZG = d.code === ZG_CODE;
                  // ZG = exemple positif d'optimisation fiscale → vert translucide.
                  // Plus avantageux Romandie → vert plein. Autres → teal (primary).
                  const fill = isCheapest || isZG ? "var(--success)" : "var(--primary)";
                  return <Cell key={d.code} fill={fill} fillOpacity={isZG ? 0.65 : 1} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Séparateur visuel + badge ZG */}
        {hasZG && (
          <div className="mt-3 flex flex-wrap items-start gap-2 rounded-md border border-dashed border-success/40 bg-success/5 p-2 text-xs">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
            <span className="font-semibold text-foreground shrink-0">ZG · Zoug</span>
            <span className="min-w-0 flex-1 text-muted-foreground break-words">
              <span className="sm:hidden">Référence fiscalité optimisée</span>
              <span className="hidden sm:inline">
                Référence fiscalité optimisée (hors scope domicile v1, {romandsCount} cantons romands au-dessus)
              </span>
            </span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <Legend color="var(--success)" label="Canton le plus avantageux (Romandie)" />
          <Legend color="var(--primary)" label="Cantons romands" />
          <Legend color="var(--success)" label="Zoug · référence fiscale" opacity={0.65} />
        </div>
      </CalcCard>

      <div className="flex flex-wrap justify-end gap-2">
        <SaveSimulationButton
          kind="canton_compare"
          inputs={form}
          summary={{
            cheapestCanton: cheapestRomand?.code,
            cheapestTax: cheapestRomand?.total,
            referenceCanton: form.referenceCanton,
            referenceTax,
            maxSavings: Math.max(0, referenceTax - (cheapestRomand?.total ?? 0)),
          }}
          defaultTitle={`Comparateur Suisse romande · réf ${form.referenceCanton}`}
        />
        <ExportPdfButton onClick={handleExport} />
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  suffix,
  wikiId,
  wikiTip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  wikiId?: string;
  wikiTip?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {wikiId && wikiTip ? <WikiTip articleId={wikiId} tip={wikiTip} /> : null}
      </Label>
      <BaseNumField
        value={String(value)}
        onChange={(v) => onChange(Number(v) || 0)}
        suffix={suffix}
      />
    </div>
  );
}

function Legend({ color, label, opacity = 1 }: { color: string; label: string; opacity?: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color, opacity }} />
      {label}
    </span>
  );
}
