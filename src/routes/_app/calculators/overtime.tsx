// src/routes/_app/calculators/overtime.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { ChevronDown, Clock, Info, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { NumField as BaseNumField } from "@/components/ui/num-field";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CalcCard, MoneyTile, Row } from "@/components/calculators/CalcUI";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { CANTONS, CANTON_BY_CODE } from "@/lib/swiss/cantons";
import {
  computeOvertime,
  OVERTIME_PARAMS_2026,
  type OvertimeInput,
  type OvertimeTaxStatus,
  type SalaryCurrency,
} from "@/lib/overtime-fr";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import { CrossCalcImpactBanner } from "@/components/calculators/CrossCalcImpactBanner";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/overtime")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Heures supp · SwissBroker Pro" }] }),
  component: OvertimeCalc,
});

const fmtEUR = (n: number) =>
  `${Math.round(n).toLocaleString("fr-FR")} €`;
const fmtCHF = (n: number) =>
  `${Math.round(n).toLocaleString("fr-CH")} CHF`;
const fmtH = (n: number) => `${Math.round(n).toLocaleString("fr-CH")} h`;

function OvertimeCalc() {
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "overtime");
  const [form, setForm] = useState<OvertimeInput>({
    taxStatus: "cross_border_fr_1983",
    workCanton: "VD",
    weeklyHours: OVERTIME_PARAMS_2026.defaultWeeklyHours,
    annualNetSalary: 72_000,
    salaryCurrency: "EUR",
    chfToEurRate: OVERTIME_PARAMS_2026.defaultChfToEurRate,
    estimatedFrenchMarginalRate: 14,
    civilStatus: "single",
    childrenCount: 0,
    spouseEmployed: false,
    spouseAnnualSalaryCHF: 0,
  });
  useHydrateFormFromPrefill(prefill, setForm);
  const set = <K extends keyof OvertimeInput>(k: K, v: OvertimeInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const result = useMemo(() => computeOvertime(form), [form]);
  const [detailOpen, setDetailOpen] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);

  const guideSteps: GuideStep[] = [
    {
      title: "Bienvenue sur le calculateur Heures supplémentaires",
      body: "Estimez l'exonération fiscale française sur les heures supplémentaires d'un frontalier, selon l'accord 1983.",
    },
    {
      target: "overtime-tax-status",
      title: "Statut fiscal du client",
      body: "L'exonération française ne s'applique qu'au régime frontalier 1983. Pour les autres statuts, le gain sera automatiquement de 0.",
    },
    {
      target: "overtime-work-data",
      title: "Heures et salaire",
      body: "Renseignez les heures hebdomadaires et le salaire net imposable. Le taux de change CHF/EUR est pré-rempli mais modifiable.",
    },
    {
      target: "overtime-savings",
      title: "Économie fiscale",
      body: "Le montant exonéré et l'économie d'impôt qui en résulte, en euros et en francs.",
    },
    {
      target: "overtime-save",
      title: "Sauvegarder la simulation",
      body: "Pensez à sauvegarder, sinon cette simulation n'apparaîtra pas dans la synthèse du rendez-vous.",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      <div className="md:col-span-5 flex items-center justify-between gap-3">
        <div className="flex-1"><CrossCalcImpactBanner calculator="overtime" clientId={clientId} /></div>
        <GuideToggleButton onClick={() => setGuideOpen(true)} />
      </div>
      <GuideMode
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        steps={guideSteps}
        title="Guide, Heures supplémentaires"
        guideId="calc-overtime"
      />
      {client && (
        <div className="md:col-span-5">
          <ClientLinkBanner client={client} />
        </div>
      )}
      <div className="md:col-span-3 space-y-4">
        <div data-guide="overtime-tax-status">
          <CalcCard
            title="Profil du frontalier"
            description="Régime fiscal et canton de travail."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Statut fiscal">
                <Select
                  value={form.taxStatus}
                  onValueChange={(v) => set("taxStatus", v as OvertimeTaxStatus)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cross_border_fr_1983">Frontalier 1983 (FR)</SelectItem>
                    <SelectItem value="cross_border_ge">Frontalier Genève</SelectItem>
                    <SelectItem value="source_taxed">Imposé à la source</SelectItem>
                    <SelectItem value="tou">TOU / Quasi-résident</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Canton de travail">
                <Select value={form.workCanton} onValueChange={(v) => set("workCanton", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANTONS.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} · {CANTON_BY_CODE[c.code]?.name ?? c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </CalcCard>
        </div>

        <div data-guide="overtime-work-data">
          <CalcCard
            title="Données de travail"
            description="Heures et salaire net imposable annuel."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumField
                label="Heures hebdomadaires"
                value={form.weeklyHours}
                onChange={(v) => set("weeklyHours", v)}
                step={0.5}
              />
              <Field label="Devise du salaire">
                <Select
                  value={form.salaryCurrency}
                  onValueChange={(v) => set("salaryCurrency", v as SalaryCurrency)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="CHF">CHF</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <NumField
                label={`Salaire net annuel imposable (${form.salaryCurrency})`}
                value={form.annualNetSalary}
                onChange={(v) => set("annualNetSalary", v)}
              />
              <NumField
                label="Taux CHF → EUR"
                value={form.chfToEurRate}
                onChange={(v) => set("chfToEurRate", v)}
                step={0.01}
              />
            </div>
          </CalcCard>
        </div>

        <CalcCard title="Données fiscales personnelles">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Situation civile">
              <Select
                value={form.civilStatus}
                onValueChange={(v) => set("civilStatus", v as "single" | "married")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Célibataire</SelectItem>
                  <SelectItem value="married">Marié·e / pacsé·e</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <NumField
              label="Nombre d'enfants à charge"
              value={form.childrenCount}
              onChange={(v) => set("childrenCount", v)}
            />
            <Field label="Conjoint salarié ?">
              <div className="flex h-9 items-center gap-2">
                <Switch
                  checked={!!form.spouseEmployed}
                  onCheckedChange={(v) => set("spouseEmployed", v)}
                />
                <span className="text-xs text-muted-foreground">
                  {form.spouseEmployed ? "Oui" : "Non"}
                </span>
              </div>
            </Field>
            {form.spouseEmployed && (
              <NumField
                label="Salaire conjoint (CHF)"
                value={form.spouseAnnualSalaryCHF ?? 0}
                onChange={(v) => set("spouseAnnualSalaryCHF", v)}
              />
            )}
            <NumField
              label="Taux marginal IR France estimé (%)"
              value={form.estimatedFrenchMarginalRate}
              onChange={(v) => set("estimatedFrenchMarginalRate", v)}
              step={1}
            />
          </div>
        </CalcCard>

        <CalcCard title="Notes & documents">
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

      <div className="space-y-4 md:col-span-2">
        <CalcCard title="1 · Calcul des heures">
          <div className="space-y-2 text-sm">
            <KV label="Heures hebdomadaires" value={`${result.weeklyHours} h/sem`} />
            <KV label="Heures annuelles travaillées" value={fmtH(result.annualHours)} strong />
            <KV label="Seuil fiscal FR reconnu" value={fmtH(result.hoursThreshold)} />
            <KV label="Heures exonérables théoriques" value={fmtH(result.exemptHoursTheoretical)} />
            <KV label="Plafond légal heures" value={`${result.hoursCap} h/an`} />
            <KV
              label="Heures exonérables retenues"
              value={fmtH(result.exemptHoursRetained)}
              tone="primary"
              strong
            />
          </div>
        </CalcCard>

        <CalcCard title="2 · Calcul du salaire exonéré">
          <div className="space-y-2 text-sm">
            <KV label="Salaire net annuel (EUR)" value={fmtEUR(result.annualNetSalaryEUR)} />
            <KV label="Salaire net annuel (CHF)" value={fmtCHF(result.annualNetSalaryCHF)} />
            <KV
              label="Part théorique exonérable"
              value={fmtEUR(result.exemptSalaryTheoreticalEUR)}
            />
            <KV label="Plafond fiscal légal" value={fmtEUR(result.exemptSalaryCapEUR)} />
            <KV
              label="Montant exonéré retenu"
              value={`${fmtEUR(result.exemptSalaryRetainedEUR)} (${fmtCHF(result.exemptSalaryRetainedCHF)})`}
              tone="primary"
              strong
            />
          </div>
        </CalcCard>

        <div data-guide="overtime-savings">
          <CalcCard title="3 · Économie fiscale">
            <Row>
              <MoneyTile
                label="Économie annuelle (CHF)"
                value={result.taxSavingsCHF}
                tone="success"
                big
                tip="Montant économisé sur l'impôt sur le revenu français grâce à l'exonération des heures supplémentaires. Applicable uniquement pour les frontaliers accord 1983."
              />
              <MoneyTile
                label="Économie annuelle (EUR)"
                value={result.taxSavingsEUR}
                tone="primary"
                hint={`Taux marginal IR FR ${result.marginalRatePct}%`}
                tip="Même économie convertie en euros. Calculée en appliquant votre taux marginal IR France au salaire exonéré retenu."
              />
            </Row>
            {!result.hasFrenchExemption && (
              <div className="mt-3 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-warning-foreground">
                Statut hors régime frontalier 1983 : l'exonération française heures sup ne
                s'applique pas. L'économie réelle pour ce client est 0.
              </div>
            )}
            <div className="mt-3 text-xs text-muted-foreground">
              Côté Suisse : aucune incidence (l'impôt suisse reste dû sur le salaire complet).
            </div>
          </CalcCard>
        </div>

        <Collapsible open={detailOpen} onOpenChange={setDetailOpen}>
          <CalcCard title="Détail du calcul">
            <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium text-primary">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {detailOpen ? "Masquer les étapes" : "Afficher les étapes"}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${detailOpen ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3 text-sm">
              <Step
                n={1}
                title="Heures annuelles"
                formula={`${result.weeklyHours} h × 52 semaines = ${fmtH(result.annualHours)}/an`}
              />
              <Step
                n={2}
                title="Heures exonérables"
                formula={`${fmtH(result.annualHours)} − ${fmtH(result.hoursThreshold)} = ${fmtH(result.exemptHoursTheoretical)}\nPlafonné à ${result.hoursCap} h max → retenu : ${fmtH(result.exemptHoursRetained)}`}
              />
              <Step
                n={3}
                title="Salaire exonéré théorique"
                formula={`${fmtEUR(result.annualNetSalaryEUR)} × (${result.exemptHoursRetained} / ${result.annualHours}) = ${fmtEUR(result.exemptSalaryTheoreticalEUR)}`}
              />
              <Step
                n={4}
                title="Plafond fiscal 2026"
                formula={`min(${fmtEUR(result.exemptSalaryTheoreticalEUR)}, ${fmtEUR(result.exemptSalaryCapEUR)}) = ${fmtEUR(result.exemptSalaryRetainedEUR)}`}
              />
              <Step
                n={5}
                title="Économie fiscale"
                formula={
                  result.hasFrenchExemption
                    ? `${fmtEUR(result.exemptSalaryRetainedEUR)} × ${result.marginalRatePct}% = ${fmtEUR(result.taxSavingsEUR)}\nEn CHF : ${fmtEUR(result.taxSavingsEUR)} / ${form.chfToEurRate} = ${fmtCHF(result.taxSavingsCHF)}`
                    : "Statut hors 1983 : exonération non applicable → 0"
                }
              />
            </CollapsibleContent>
          </CalcCard>
        </Collapsible>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span>
            Méthode officielle FR 2026 · plafonds {OVERTIME_PARAMS_2026.hoursCapPerYear} h /
            {" "}
            {OVERTIME_PARAMS_2026.salaryCapEUR.toLocaleString("fr-FR")} €
          </span>
        </div>

        <div className="flex justify-end" data-guide="overtime-save">
          <SaveSimulationButton
            kind="overtime"
            inputs={form}
            summary={{
              status: result.status,
              annualHours: result.annualHours,
              exemptHoursRetained: result.exemptHoursRetained,
              exemptSalaryRetainedEUR: result.exemptSalaryRetainedEUR,
              exemptSalaryRetainedCHF: result.exemptSalaryRetainedCHF,
              taxSavingsEUR: result.taxSavingsEUR,
              taxSavingsCHF: result.taxSavingsCHF,
              // compat
              overtimeCHF: result.overtimeCHF,
              netOvertimeCHF: result.netOvertimeCHF,
              totalTaxOnOvertime: result.totalTaxOnOvertime,
              taxSavings: result.taxSavings,
              hasFrenchExemption: result.hasFrenchExemption,
            }}
            defaultTitle={`Heures sup · ${form.workCanton} · ${result.exemptHoursRetained} h exonérées`}
          />
        </div>
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

function NumField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <Field label={label}>
      <BaseNumField
        value={String(value)}
        onChange={(v) => onChange(Number(v) || 0)}
        step={step}
      />
    </Field>
  );
}

function KV({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "primary";
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`tabular-nums ${strong ? "font-semibold" : ""} ${tone === "primary" ? "text-primary" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function Step({ n, title, formula }: { n: number; title: string; formula: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/10">{n}</span>
        {title}
      </div>
      <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">{formula}</pre>
    </div>
  );
}