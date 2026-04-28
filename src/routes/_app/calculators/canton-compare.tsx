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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CANTONS } from "@/lib/swiss/cantons";
import { computeIncomeTax, type IncomeTaxInput } from "@/lib/tax/income";
import { CalcCard } from "@/components/calculators/CalcUI";
import { formatCHF } from "@/lib/format";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { exportCantonComparePdf } from "@/lib/pdf/reports";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/_app/calculators/canton-compare")({
  head: () => ({ meta: [{ title: "Comparateur cantonal — SwissBroker Pro" }] }),
  component: CantonCompareCalc,
});

function CantonCompareCalc() {
  const [form, setForm] = useState({
    grossSalary: 120_000,
    spouseGrossSalary: 0,
    status: "single" as IncomeTaxInput["status"],
    children: 0,
    netWealth: 0,
    referenceCanton: "VD",
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const data = useMemo(() => {
    const rows = CANTONS.map((c) => {
      const r = computeIncomeTax({
        canton: c.code,
        status: form.status,
        children: form.children,
        grossSalary: form.grossSalary,
        spouseGrossSalary: form.spouseGrossSalary,
        netWealth: form.netWealth,
      });
      return { code: c.code, name: c.name, total: r.totalTax, effective: r.effectiveRate };
    });
    rows.sort((a, b) => a.total - b.total);
    return rows;
  }, [form]);

  const referenceTax = data.find((d) => d.code === form.referenceCanton)?.total ?? 0;

  const { user } = useAuth();
  const handleExport = () =>
    exportCantonComparePdf({
      header: { brokerEmail: user?.email ?? undefined },
      input: form,
      rows: data,
    });

  return (
    <div className="space-y-6">
      <CalcCard title="Profil à comparer" description="Charge fiscale annuelle simulée dans les 26 cantons.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumField label="Salaire brut (CHF)" value={form.grossSalary} onChange={(v) => set("grossSalary", v)} />
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Situation civile</Label>
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
            <NumField label="Salaire brut conjoint (CHF)" value={form.spouseGrossSalary} onChange={(v) => set("spouseGrossSalary", v)} />
          )}
          <NumField label="Nombre d'enfants" value={form.children} onChange={(v) => set("children", v)} />
          <NumField label="Fortune nette (CHF)" value={form.netWealth} onChange={(v) => set("netWealth", v)} />
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Canton de référence</Label>
            <Select value={form.referenceCanton} onValueChange={(v) => set("referenceCanton", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CANTONS.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CalcCard>

      <CalcCard title="Classement par charge fiscale totale">
        <div className="h-[520px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 12, right: 32 }}>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <YAxis type="category" dataKey="code" width={40} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
                formatter={(v: number, _: string, props) => [
                  formatCHF(v),
                  `${props.payload.name} — ${props.payload.effective}%`,
                ]}
              />
              <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                {data.map((d) => (
                  <Cell
                    key={d.code}
                    fill={
                      d.code === form.referenceCanton
                        ? "var(--primary)"
                        : d.total < referenceTax
                          ? "var(--success)"
                          : "var(--muted-foreground)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <Legend color="var(--success)" label="Moins cher que votre canton" />
          <Legend color="var(--primary)" label="Votre canton" />
          <Legend color="var(--muted-foreground)" label="Plus cher" />
        </div>
      </CalcCard>

      <div className="flex flex-wrap justify-end gap-2">
        <SaveSimulationButton
          kind="canton_compare"
          inputs={form}
          summary={{
            cheapestCanton: data[0]?.code,
            cheapestTax: data[0]?.total,
            referenceCanton: form.referenceCanton,
            referenceTax,
            maxSavings: Math.max(0, referenceTax - (data[0]?.total ?? 0)),
          }}
          defaultTitle={`Comparateur 26 cantons — réf ${form.referenceCanton}`}
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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
