import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, ShieldCheck, TrendingUp, Activity } from "lucide-react";
import {
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  CartesianGrid,
  ComposedChart,
} from "recharts";
import { CalcCard, MoneyTile, Row } from "@/components/calculators/CalcUI";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { getSelectableCantons } from "@/lib/swiss/cantons";
import {
  compareVestedStrategies,
  recommendVestedStrategy,
  VESTED_STRATEGIES,
  type VestedStrategy,
} from "@/lib/lpp/vested";
import { formatCHF } from "@/lib/format";
import { exportVestedBenefitsPdf } from "@/lib/pdf/reports";

export const Route = createFileRoute("/_app/calculators/vested-benefits")({
  head: () => ({ meta: [{ title: "Libre passage · SwissBroker Pro" }] }),
  component: VestedBenefitsCalc,
});

const STRATEGY_ICONS: Record<VestedStrategy, React.ElementType> = {
  security: ShieldCheck,
  balanced: Activity,
  dynamic: TrendingUp,
};

function VestedBenefitsCalc() {
  const [form, setForm] = useState({
    initialBalance: 150_000,
    yearsToRetirement: 20,
    withdrawalCanton: "VD",
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const projections = useMemo(
    () =>
      compareVestedStrategies(
        form.initialBalance,
        form.yearsToRetirement,
        form.withdrawalCanton,
      ),
    [form],
  );

  const recommended = recommendVestedStrategy(form.yearsToRetirement);

  // Données graphique : courbe par stratégie
  const chartData = useMemo(() => {
    const len = projections[0]?.yearByYear.length ?? 0;
    const rows: Array<Record<string, number>> = [];
    for (let i = 0; i < len; i++) {
      const row: Record<string, number> = { year: i };
      projections.forEach((p) => {
        row[p.strategy.id] = p.yearByYear[i].balance;
      });
      rows.push(row);
    }
    return rows;
  }, [projections]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      <div className="md:col-span-2">
        <CalcCard
          title="Paramètres"
          description="Capital actuel + horizon jusqu'à la retraite."
        >
          <div className="space-y-4">
            <Field label="Capital libre passage actuel (CHF)">
              <Input
                type="number"
                value={form.initialBalance}
                onChange={(e) => set("initialBalance", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Années jusqu'au retrait">
              <Input
                type="number"
                value={form.yearsToRetirement}
                onChange={(e) => set("yearsToRetirement", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Canton de retrait">
              <Select
                value={form.withdrawalCanton}
                onValueChange={(v) => set("withdrawalCanton", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {getSelectableCantons().map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              Recommandation
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pour {form.yearsToRetirement} ans d'horizon, la stratégie{" "}
              <span className="font-semibold text-foreground">
                {VESTED_STRATEGIES.find((s) => s.id === recommended)?.label}
              </span>{" "}
              est la plus cohérente.
            </p>
          </div>
        </CalcCard>
      </div>

      <div className="space-y-4 md:col-span-3">
        <div className="flex justify-end">
          <ExportPdfButton
            onClick={() =>
              exportVestedBenefitsPdf({
                input: form,
                projections,
                recommended,
              })
            }
          />
        </div>
        <CalcCard title="Projection capital · 3 stratégies comparées">
          <div className="h-72 chart-rise">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis
                  dataKey="year"
                  tickFormatter={(v) => `+${v}a`}
                  className="text-xs"
                />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  className="text-xs"
                />
                <Tooltip
                  formatter={(v: number) => formatCHF(v)}
                  labelFormatter={(l) => `Année +${l}`}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="security"
                  name="Sécurité"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="balanced"
                  name="Équilibré"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="dynamic"
                  name="Dynamique"
                  stroke="hsl(var(--success, 142 76% 36%))"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CalcCard>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {projections.map((p) => {
            const Icon = STRATEGY_ICONS[p.strategy.id];
            const isRecommended = p.strategy.id === recommended;
            return (
              <CalcCard
                key={p.strategy.id}
                className={isRecommended ? "ring-2 ring-primary/40" : undefined}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">{p.strategy.label}</h4>
                  </div>
                  {isRecommended && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                      Conseillé
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.strategy.description}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <MoneyTile label="Capital final" value={p.finalBalance} tone="primary" />
                  <MoneyTile label="Gains nets" value={p.totalGains} tone="success" />
                </div>
                <dl className="mt-3 space-y-1 text-xs">
                  <Line2 label="Rendement net annualisé" value={`${p.netReturn} %`} />
                  <Line2 label="Frais annuels" value={`${p.strategy.totalFees} %`} />
                  <Line2 label="Fourchette basse (-1σ)" value={formatCHF(p.finalLow)} />
                  <Line2 label="Fourchette haute (+1σ)" value={formatCHF(p.finalHigh)} />
                  {p.estimatedExitTax !== undefined && (
                    <Line2
                      label="Impôt sortie estimé"
                      value={formatCHF(p.estimatedExitTax)}
                    />
                  )}
                  {p.estimatedExitTax !== undefined && (
                    <Line2
                      label="Net après impôt"
                      value={formatCHF(p.finalBalance - p.estimatedExitTax)}
                      bold
                    />
                  )}
                </dl>
              </CalcCard>
            );
          })}
        </div>

        <CalcCard>
          <Row>
            <div className="text-xs text-muted-foreground">
              <strong className="text-foreground">Rappel libre passage :</strong> compte ouvert
              entre deux affiliations LPP ou en cas de départ à l'étranger / indépendance. Possibilité
              de fragmenter sur plusieurs comptes pour casser la progressivité de l'impôt sur prestation
              en capital.
            </div>
            <div className="text-xs text-muted-foreground">
              <strong className="text-foreground">Hypothèses :</strong> rendements nets de frais,
              fourchettes ±1 écart-type. Performance passée non garantie. Ajustez l'horizon et la
              tolérance au risque selon le profil client.
            </div>
          </Row>
        </CalcCard>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Line2({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? "font-semibold" : ""}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
