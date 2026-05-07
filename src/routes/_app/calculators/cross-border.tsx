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
import { NumField as BaseNumField } from "@/components/ui/num-field";
import { Label } from "@/components/ui/label";
import { Globe, Info, ArrowRightLeft } from "lucide-react";
import { CalcCard, MoneyTile, PctTile, Row } from "@/components/calculators/CalcUI";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { formatCHF } from "@/lib/format";
import {
  computeCrossBorder,
  isFrAccordCanton,
  FR_ACCORD_CANTONS,
} from "@/lib/tax/cross-border";
import { CANTON_BY_CODE } from "@/lib/swiss/cantons";
import { exportCrossBorderPdf } from "@/lib/pdf/reports";

import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { WikiTip } from "@/components/calculators/WikiTip";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/cross-border")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Frontaliers · SwissBroker Pro" }] }),
  component: CrossBorderCalc,
});

const ELIGIBLE_CANTONS = [...FR_ACCORD_CANTONS, "GE", "TI"] as const;

function CrossBorderCalc() {
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "cross-border");
  const [form, setForm] = useState({
    workCanton: "VD" as string,
    grossAnnualSalary: 95_000,
    status: "single" as "single" | "married",
    children: 0,
    spouseEmployed: false,
    spouseGrossSalary: 0,
    eurChfRate: 0.95,
  });
  useHydrateFormFromPrefill(prefill, setForm);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const result = useMemo(() => computeCrossBorder(form), [form]);

  const regimeBadge = isFrAccordCanton(form.workCanton)
    ? "Accord 4.5 %"
    : form.workCanton === "GE"
      ? "GE · IS genevoise"
      : form.workCanton === "TI"
        ? "TI · accord 2023"
        : "Hors régime";
  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: "Bienvenue", body: "Calculateur dédié aux travailleurs frontaliers (accord franco-suisse)." },
    { title: "Statut", body: "Frontalier de droit (rentre tous les jours) ou quasi-résident. Régime fiscal différent." },
    { title: "Imposition", body: "Selon le canton (GE = imposition en Suisse, VD/NE/JU = imposition en France)." }
  ];



  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title="Guide frontaliers" />
      <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>


      {client && <div className="md:col-span-5"><ClientLinkBanner client={client} /></div>}
      <div className="md:col-span-3">
        <CalcCard
          title="Profil frontalier"
          description="Calcul automatique du régime applicable (FR-CH 4.5 %, GE, TI)."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Canton de travail">
              <Select value={form.workCanton} onValueChange={(v) => set("workCanton", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ELIGIBLE_CANTONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c} · {CANTON_BY_CODE[c]?.name ?? c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Régime applicable">
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                <Globe className="mr-2 h-4 w-4 text-primary" />
                {regimeBadge}
              </div>
            </Field>
            <NumField
              label="Salaire annuel brut (CHF)"
              value={form.grossAnnualSalary}
              onChange={(v) => set("grossAnnualSalary", v)}
            />
            <Field label="Situation civile">
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as "single" | "married")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Célibataire</SelectItem>
                  <SelectItem value="married">Marié·e / pacsé·e</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <NumField
              label="Enfants à charge"
              value={form.children}
              onChange={(v) => set("children", v)}
            />
            {form.status === "married" && (
              <NumField
                label="Salaire conjoint annuel (CHF)"
                value={form.spouseGrossSalary}
                onChange={(v) => set("spouseGrossSalary", v)}
              />
            )}
            <NumField
              label="Taux EUR/CHF"
              value={form.eurChfRate}
              onChange={(v) => set("eurChfRate", v)}
              step={0.01}
            />
          </div>
        </CalcCard>

        <div className="mt-4">
          <CalcCard title="Notes du régime">
            <ul className="space-y-2 text-sm text-muted-foreground">
              {result.notes.map((n, i) => (
                <li key={i} className="flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </CalcCard>
        </div>
      </div>

      <div className="space-y-4 md:col-span-2">
        <div className="flex justify-end">
          <ExportPdfButton
            onClick={() => exportCrossBorderPdf({ input: form, result })}
          />
        </div>
        <CalcCard title={result.regimeLabel}>
          <Row>
            <MoneyTile label="Net annuel" value={result.netAnnual} tone="success" big tip="Revenu net annuel après tous prélèvements (cotisations + impôts)." />
            <PctTile label="Charge totale" value={result.totalRate} tone="primary" tip="Charge fiscale totale en pourcentage du revenu brut." />
          </Row>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MoneyTile label="Retenue Suisse" value={result.swissTax} hint={`${result.swissRate}%`} />
            <MoneyTile
              label="Impôt résident"
              value={result.foreignTax}
              hint={`${result.foreignRate}%`}
            />
          </div>
        </CalcCard>

        {result.alternative && (
          <CalcCard title="Comparatif alternatif">
            <div className="flex items-start gap-2 text-sm">
              <ArrowRightLeft className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <div className="font-medium">{result.alternative.label}</div>
                <div className="mt-1 text-muted-foreground">
                  Total : {formatCHF(result.alternative.totalTax)} · Net :{" "}
                  {formatCHF(result.alternative.netAnnual)}
                </div>
                <div
                  className={`mt-2 text-xs font-semibold ${
                    result.alternative.delta > 0
                      ? "text-success"
                      : "text-destructive"
                  }`}
                >
                  Régime actuel{" "}
                  {result.alternative.delta > 0
                    ? `gagne ${formatCHF(result.alternative.delta)}`
                    : `coûte ${formatCHF(Math.abs(result.alternative.delta))} de plus`}
                </div>
              </div>
            </div>
          </CalcCard>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, wikiId, wikiTip }: { label: string; children: React.ReactNode; wikiId?: string; wikiTip?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {wikiId ? <WikiTip articleId={wikiId} tip={wikiTip ?? label} /> : null}
      </Label>
      {children}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step: _step,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
}) {
  return (
    <Field label={label}>
      <BaseNumField
        value={String(value)}
        onChange={(v) => onChange(Number(v) || 0)}
        suffix={suffix}
      />
    </Field>
  );
}
