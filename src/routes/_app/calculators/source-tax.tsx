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
import { Checkbox } from "@/components/ui/checkbox";
import { getSelectableCantons, CROSS_BORDER_FR_CANTONS } from "@/lib/swiss/cantons";
import { computeSourceTax, type SourceScale } from "@/lib/tax/source";
import { CalcCard, MoneyTile, PctTile, Row } from "@/components/calculators/CalcUI";
import { Info } from "lucide-react";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { exportSourceTaxPdf } from "@/lib/pdf/reports";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useAuth } from "@/contexts/AuthContext";

import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { WikiTip } from "@/components/calculators/WikiTip";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/source-tax")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Impôt à la source · SwissBroker Pro" }] }),
  component: SourceTaxCalc,
});

function SourceTaxCalc() {
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "source-tax");
  const [form, setForm] = useState({
    canton: "GE",
    scale: "A" as SourceScale,
    monthlyGross: 8_000,
    children: 0,
    church: false,
    isCrossBorderFR: false,
  });
  useHydrateFormFromPrefill(prefill, setForm);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const { user } = useAuth();
  const crossBorderEligible = CROSS_BORDER_FR_CANTONS.includes(form.canton);
  const result = useMemo(() => computeSourceTax(form), [form]);
  const handleExport = () =>
    exportSourceTaxPdf({
      header: { brokerEmail: user?.email ?? undefined },
      input: form,
      result,
    });
  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: "Bienvenue", body: "Estimation de l'impôt à la source (barèmes A/B/C/H selon situation)." },
    { title: "Barème", body: "A = célibataire, B = marié monoactif, C = marié biactif, H = famille monoparentale." },
    { title: "TOU", body: "Si vous gagnez plus de 90 % de vos revenus en Suisse, vous pouvez demander la TOU pour récupérer vos déductions." }
  ];



  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title="Guide impôt à la source" />
      <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>


      {client && <div className="md:col-span-5"><ClientLinkBanner client={client} /></div>}
      <div className="md:col-span-3">
        <CalcCard
          title="Situation salariée"
          description="Barèmes A / B / C / H 2026 · accord franco-suisse pris en compte."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Canton de travail</Label>
              <Select value={form.canton} onValueChange={(v) => set("canton", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {getSelectableCantons().map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span>Barème</span>
                <WikiTip articleId="frontaliers" tip="A = célibataire, B = marié monoactif, C = marié biactif, H = famille monoparentale." />
              </Label>
              <Select value={form.scale} onValueChange={(v) => set("scale", v as SourceScale)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A · Célibataire</SelectItem>
                  <SelectItem value="B">B · Marié monoactif</SelectItem>
                  <SelectItem value="C">C · Marié biactif</SelectItem>
                  <SelectItem value="H">H · Famille monoparentale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Salaire brut mensuel</Label>
              <BaseNumField
                value={String(form.monthlyGross)}
                onChange={(v) => set("monthlyGross", Number(v) || 0)}
                suffix="CHF"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Nombre d'enfants</Label>
              <BaseNumField
                value={String(form.children)}
                onChange={(v) => set("children", Number(v) || 0)}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={form.church}
                onCheckedChange={(v) => set("church", Boolean(v))}
              />
              Contribuable d'une église officielle
            </label>
            {crossBorderEligible && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={form.isCrossBorderFR}
                  onCheckedChange={(v) => set("isCrossBorderFR", Boolean(v))}
                />
                Frontalier France (accord 4.5 %)
              </label>
            )}
          </div>
          {form.isCrossBorderFR && (
            <div className="mt-4 flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                Frontalier France : retenue suisse limitée à <strong>4.5 %</strong> du brut, imposition principale en France. La Suisse rétrocède une partie aux finances françaises.
              </p>
            </div>
          )}
        </CalcCard>
      </div>

      <div className="space-y-4 md:col-span-2">
        <CalcCard title="Retenue à la source">
          <Row>
            <PctTile label="Taux appliqué" value={result.rate} tone="primary" tip="Taux d'imposition à la source effectivement appliqué (barème + canton)." />
            <MoneyTile label="Impôt mensuel" value={result.monthlyTax} tone="primary" big tip="Impôt à la source prélevé chaque mois sur le salaire brut." />
          </Row>
          <div className="mt-3">
            <MoneyTile label="Impôt annuel (×12)" value={result.annualTax} tone="default" tip="Impôt annualisé = impôt mensuel × 12." />
          </div>
          {result.crossBorderNote && (
            <p className="mt-3 text-xs text-muted-foreground">{result.crossBorderNote}</p>
          )}
        </CalcCard>
        <div className="flex flex-wrap justify-end gap-2">
          <SaveSimulationButton
            kind="source_tax"
            inputs={form}
            summary={{
              rate: result.rate,
              monthlyTax: result.monthlyTax,
              annualTax: result.annualTax,
            }}
            defaultTitle={`Source ${form.canton} ${form.scale} · ${form.monthlyGross}/mois`}
          />
          <ExportPdfButton onClick={handleExport} />
        </div>
      </div>
    </div>
  );
}
