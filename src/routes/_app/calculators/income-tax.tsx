import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
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
import { getSelectableCantons } from "@/lib/swiss/cantons";
import { computeIncomeTax, type IncomeTaxInput } from "@/lib/tax/income";
import { CalcCard, MoneyTile, PctTile, Row } from "@/components/calculators/CalcUI";
import { formatCHF } from "@/lib/format";
import { runOptimizer } from "@/lib/optimizer";
import { OptimizationsPanel } from "@/components/optimizer/OptimizationsPanel";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { exportIncomeTaxPdf } from "@/lib/pdf/reports";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useAuth } from "@/contexts/AuthContext";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { WikiTip } from "@/components/calculators/WikiTip";
import { getClientTaxContext } from "@/lib/clients/to-calculator-input";
import { TAX_STATUS_LABELS, type TaxStatus } from "@/lib/swiss/enums";
import { computeSourceTax, inferSourceScale } from "@/lib/tax/source";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/income-tax")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Impôt revenu & fortune · SwissBroker Pro" }] }),
  component: IncomeTaxCalculator,
});

function IncomeTaxCalculator() {
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "income-tax");

  const [form, setForm] = useState({
    canton: "VD",
    status: "single" as IncomeTaxInput["status"],
    confession: "none" as NonNullable<IncomeTaxInput["confession"]>,
    children: 0,
    age: 40,
    lppPlan: "mandatory" as NonNullable<IncomeTaxInput["lppPlan"]>,
    grossSalary: 100_000,
    spouseGrossSalary: 0,
    bonus: 0,
    otherIncome: 0,
    pillar3aContributions: 0,
    lppBuyback: 0,
    healthInsurancePremiums: 0,
    mortgageInterest: 0,
    realEstateMaintenance: 0,
    netWealth: 0,
    lppBuybackCapacity: 0,
    pillar3aBalance: 0,
  });

  useHydrateFormFromPrefill(prefill, setForm);

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const { user } = useAuth();
  const result = useMemo(() => computeIncomeTax(form), [form]);
  const optimizations = useMemo(
    () =>
      runOptimizer({
        taxInput: form,
        lppBuybackCapacity: form.lppBuybackCapacity,
        pillar3aCurrent: form.pillar3aContributions,
        pillar3aBalance: form.pillar3aBalance,
        hasLPP: true,
        ...(client ? getClientTaxContext(client) : {}),
      }),
    [form, client],
  );

  const handleExport = () =>
    exportIncomeTaxPdf({
      header: { brokerEmail: user?.email ?? undefined },
      input: form,
      result,
    });
  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: "Bienvenue", body: "Estimation rapide de l'impôt sur le revenu fédéral, cantonal et communal." },
    { title: "Situation civile", body: "Détermine le barème (célibataire, marié, famille monoparentale)." },
    { title: "Déductions", body: "3a, rachat LPP, intérêts hypothécaires, primes maladie : à renseigner pour le calcul net." }
  ];



  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title="Guide impôt revenu" />
      <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>


      {client && (
        <div className="md:col-span-5">
          <ClientLinkBanner client={client} />
        </div>
      )}
      <div className="md:col-span-3">
        <CalcCard title="Situation" description="Renseignez votre profil fiscal.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Canton" wikiId="ifd-icc" wikiTip="Détermine le barème ICC, le coefficient cantonal et le multiplicateur communal.">
              <Select value={form.canton} onValueChange={(v) => setField("canton", v)}>
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
            <Field label="Situation civile" wikiId="ifd-icc" wikiTip="Marié = splitting partiel (barème plus favorable). Famille monoparentale = barème spécial.">
              <Select
                value={form.status}
                onValueChange={(v) => setField("status", v as IncomeTaxInput["status"])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Célibataire</SelectItem>
                  <SelectItem value="married">Marié·e</SelectItem>
                  <SelectItem value="single_with_children">Famille monoparentale</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Confession" wikiId="ifd-icc" wikiTip="Catholique ou protestante = impôt ecclésiastique ajouté (selon canton).">
              <Select
                value={form.confession}
                onValueChange={(v) =>
                  setField("confession", v as NonNullable<IncomeTaxInput["confession"]>)
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  <SelectItem value="catholic">Catholique romaine</SelectItem>
                  <SelectItem value="protestant">Protestante</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <NumField label="Nombre d'enfants" value={form.children} onChange={(v) => setField("children", v)} />
            <NumField label="Âge du contribuable" value={form.age} onChange={(v) => setField("age", v)} wikiId="lpp-credits" wikiTip="Détermine la bonification LPP (7 % à 25-34 ans, 10 % à 35-44, 15 % à 45-54, 18 % à 55-65). Part salarié = 50 % de la bonification." />
            <Field label="Plan LPP" wikiId="lpp-base" wikiTip="Obligatoire : plafond 90 720 CHF. Cadres : sur-obligatoire jusqu'à ~362 880 CHF. 1e : individualisé jusqu'à 860 000 CHF. Impacte la part salarié déductible.">
              <Select value={form.lppPlan} onValueChange={(v) => setField("lppPlan", v as typeof form.lppPlan)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mandatory">Obligatoire (plafond 90 720)</SelectItem>
                  <SelectItem value="cadres">Cadres / sur-obligatoire</SelectItem>
                  <SelectItem value="1e">Plan 1e (jusqu'à 860 000)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <NumField
              label="Primes maladie réelles (CHF, optionnel)"
              value={form.healthInsurancePremiums}
              onChange={(v) => setField("healthInsurancePremiums", v)}
              wikiId="ifd-icc"
              wikiTip="Si renseigné, remplace le forfait cantonal. Sinon : forfait cantonal 2026 appliqué automatiquement (GE 2 400 / VD 2 200 / FR 2 000 / NE 2 300 / BE 2 600 / ZH 2 600…)."
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumField label="Salaire brut annuel (CHF)" value={form.grossSalary} onChange={(v) => setField("grossSalary", v)} />
            {form.status === "married" && (
              <NumField
                label="Salaire brut conjoint (CHF)"
                value={form.spouseGrossSalary}
                onChange={(v) => setField("spouseGrossSalary", v)}
              />
            )}
            <NumField label="Bonus (CHF)" value={form.bonus} onChange={(v) => setField("bonus", v)} />
            <NumField
              label="Autres revenus (CHF)"
              value={form.otherIncome}
              onChange={(v) => setField("otherIncome", v)}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumField
              label="Cotisations 3a (CHF)"
              value={form.pillar3aContributions}
              onChange={(v) => setField("pillar3aContributions", v)}
              wikiId="p3a-base"
              wikiTip="Salarié LPP : max 7 258 CHF (2026), 100 % déductible. Indépendant sans LPP : 20 % du revenu, max 36 288 CHF."
            />
            <NumField
              label="Rachat LPP (CHF)"
              value={form.lppBuyback}
              onChange={(v) => setField("lppBuyback", v)}
              wikiId="lpp-rachat"
              wikiTip="Déductible à 100 %. Capital bloqué 3 ans avant retrait en capital. Plafond sur certificat LPP."
            />
            <NumField
              label="Intérêts hypothécaires (CHF)"
              value={form.mortgageInterest}
              onChange={(v) => setField("mortgageInterest", v)}
              wikiId="valeur-locative"
              wikiTip="Déductibles à 100 %. Couplés à la valeur locative ajoutée au revenu."
            />
            <NumField
              label="Entretien immobilier (CHF)"
              value={form.realEstateMaintenance}
              onChange={(v) => setField("realEstateMaintenance", v)}
              wikiId="valeur-locative"
              wikiTip="Forfait 10 ou 20 % du loyer théorique selon âge du bien, ou frais réels. Travaux à valeur ajoutée non déductibles."
            />
            <NumField
              label="Fortune nette (CHF)"
              value={form.netWealth}
              onChange={(v) => setField("netWealth", v)}
              wikiId="fortune"
              wikiTip="Fortune nette imposable (actifs - dettes). Avoirs LPP / 3a exonérés tant que non retirés."
            />
            <NumField
              label="Capacité de rachat LPP (CHF)"
              value={form.lppBuybackCapacity}
              onChange={(v) => setField("lppBuybackCapacity", v)}
              wikiId="lpp-rachat"
              wikiTip="Différence entre l'avoir LPP cible et l'avoir actuel (figure sur le certificat LPP)."
            />
            <NumField
              label="Capital 3a accumulé (CHF)"
              value={form.pillar3aBalance}
              onChange={(v) => setField("pillar3aBalance", v)}
              wikiId="p3a-base"
              wikiTip="Solde total cumulé sur vos comptes 3a (banque + assurance)."
            />
          </div>
        </CalcCard>
      </div>

      <div className="space-y-4 md:col-span-2">
        <CalcCard title="Résultat fiscal" description="Estimation barèmes 2026.">
          <Row>
            <MoneyTile label="Impôt total" value={result.totalTax} tone="primary" big tip="Somme IFD + cantonal + communal + paroissial sur la base imposable." />
            <PctTile label="Taux effectif" value={result.effectiveRate} tone="primary" tip="Impôt total / revenu imposable. Taux moyen réellement payé." />
          </Row>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MoneyTile label="IFD" value={result.ifd} tip="Impôt fédéral direct, barème progressif fédéral identique dans toute la Suisse." />
            <MoneyTile label="Cantonal" value={result.cantonal} tip="Part cantonale de l'impôt sur le revenu (barème du canton)." />
            <MoneyTile label="Communal" value={result.communal} tip="Part communale de l'impôt (multiplicateur de la commune appliqué à l'impôt cantonal)." />
            <MoneyTile label="Paroissial" value={result.church} tip="Impôt ecclésiastique cantonal (selon confession et canton)." />
            <MoneyTile label="Fortune" value={result.wealthTax} tip="Impôt cantonal et communal sur la fortune nette imposable." />
            <PctTile label="Taux marginal" value={result.marginalRate} tone="warning" tip="Taux d'impôt sur le prochain franc gagné. Sert pour optimiser une déduction." />
          </div>
        </CalcCard>

        <CalcCard title="Détail revenu imposable">
          <dl className="space-y-2 text-sm">
            <Line label="Revenu brut" value={formatCHF(result.grossIncome)} />
            <Line label="− AVS / AI / APG (5.3 %)" value={formatCHF(-result.deductions.avs)} />
            <Line label="− Assurance chômage" value={formatCHF(-result.deductions.ac)} />
            <Line label="− LPP part salarié" value={formatCHF(-result.deductions.lpp)} />
            <Line label="− 3a" value={formatCHF(-result.deductions.pillar3a)} />
            <Line label="− Rachat LPP" value={formatCHF(-result.deductions.lppBuyback)} />
            <Line label="− Frais professionnels" value={formatCHF(-result.deductions.professional)} />
            <Line label="− Assurance maladie" value={formatCHF(-result.deductions.healthInsurance)} />
            <Line label="− Hypothèque & immo" value={formatCHF(-(result.deductions.mortgage + result.deductions.realEstate))} />
            <div className="my-2 border-t border-border" />
            <Line label="Revenu imposable" value={formatCHF(result.taxableIncomeCC)} bold />
          </dl>
        </CalcCard>
      </div>

      <div className="lg:col-span-5">
        <OptimizationsPanel optimizations={optimizations} />
      </div>

      <div className="flex flex-wrap justify-end gap-2 lg:col-span-5">
        <SaveSimulationButton
          kind="income_tax"
          inputs={form}
          summary={{
            totalTax: result.totalTax,
            effectiveRate: result.effectiveRate,
            marginalRate: result.marginalRate,
            taxableIncomeCC: result.taxableIncomeCC,
            ifd: result.ifd,
            cantonal: result.cantonal,
            communal: result.communal,
          }}
          defaultTitle={`Impôt ${form.canton} · ${formatCHF(form.grossSalary)}`}
        />
        <ExportPdfButton onClick={handleExport} />
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  wikiId,
  wikiTip,
}: {
  label: string;
  children: React.ReactNode;
  wikiId?: string;
  wikiTip?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {wikiId && wikiTip ? <WikiTip articleId={wikiId} tip={wikiTip} /> : null}
      </Label>
      {children}
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
    <Field label={label} wikiId={wikiId} wikiTip={wikiTip}>
      <BaseNumField
        value={String(value)}
        onChange={(v) => onChange(Number(v) || 0)}
        suffix={suffix}
      />
    </Field>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? "font-semibold" : ""}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
