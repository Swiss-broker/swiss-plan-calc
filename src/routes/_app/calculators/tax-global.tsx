import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Sparkles, Info, TrendingDown, TrendingUp, ArrowRight } from "lucide-react";

import { CalcCard, MoneyTile, PctTile, Row, InfoLabel } from "@/components/calculators/CalcUI";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { NumField as BaseNumField } from "@/components/ui/num-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

import { CANTONS } from "@/lib/swiss/cantons";
import { formatCHF } from "@/lib/format";
import { useT } from "@/contexts/LanguageContext";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";

import { computeTaxGlobal } from "@/lib/tax-global/engine";
import { buildScenarios } from "@/lib/tax-global/scenarios";
import { createDefaultInput } from "@/lib/tax-global/profile";
import type { TaxGlobalInput } from "@/lib/tax-global/types";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/tax-global")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Calculateur Fiscal Global · SwissBroker Pro" }] }),
  component: TaxGlobalCalc,
});

function TaxGlobalCalc() {
  const t = useT();
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "tax-global");

  const [form, setForm] = useState<TaxGlobalInput>(() => createDefaultInput());
  useHydrateFormFromPrefill(
    prefill as Partial<Record<string, unknown>> | null,
    setForm as unknown as (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void,
  );

  const set = <K extends keyof TaxGlobalInput>(k: K, v: TaxGlobalInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const result = useMemo(() => computeTaxGlobal(form), [form]);
  const scenarios = useMemo(() => buildScenarios(form), [form]);

  const selectableCantons = CANTONS.filter((c) => c.selectable);
  const showFortune = result.regime === "resident_ordinary";
  const showFrontalierBlock =
    result.regime === "cross_border_ge" || result.regime === "cross_border_fr_1983";
  const showTouBlock = result.regime === "source_taxed" || result.regime === "tou";

  return (
    <div className="space-y-6">
      {client && <ClientLinkBanner client={client} />}

      {/* Hero */}
      <CalcCard className="bg-gradient-primary text-primary-foreground">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-1 h-6 w-6" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">{t("calc.global.title")}</h2>
              <Badge variant="secondary" className="bg-white/20 text-white">
                {t("calc.global.badge.new")}
              </Badge>
            </div>
            <p className="mt-1 text-sm opacity-90">{t("calc.global.subtitle")}</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <span className="opacity-80">{t("calc.global.regime.detected")} :</span>
              <span>{result.regimeLabel}</span>
            </div>
          </div>
        </div>
      </CalcCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* LEFT — Fiche client */}
        <div className="space-y-4 lg:col-span-3">
          <CalcCard>
            <Accordion type="multiple" defaultValue={["identity", "income"]}>
              <AccordionItem value="identity">
                <AccordionTrigger>{t("calc.global.section.identity")}</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={t("calc.global.field.canton")}>
                      <Select value={form.canton} onValueChange={(v) => set("canton", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {selectableCantons.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.code} · {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t("calc.global.field.country")}>
                      <Select
                        value={form.countryOfResidence}
                        onValueChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            countryOfResidence: v,
                            // Auto-cohérence permis ↔ résidence pour éviter "régime inconnu"
                            permit:
                              v !== "CH" && (f.permit === "swiss" || f.permit === "C")
                                ? "G"
                                : v === "CH" && f.permit === "G"
                                  ? "C"
                                  : f.permit,
                          }))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CH">🇨🇭 Suisse</SelectItem>
                          <SelectItem value="FR">🇫🇷 France</SelectItem>
                          <SelectItem value="IT">🇮🇹 Italie</SelectItem>
                          <SelectItem value="DE">🇩🇪 Allemagne</SelectItem>
                          <SelectItem value="AT">🇦🇹 Autriche</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t("calc.global.field.permit")}>
                      <Select
                        value={form.permit}
                        onValueChange={(v) =>
                          set("permit", v as TaxGlobalInput["permit"])
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="swiss">🇨🇭 Suisse</SelectItem>
                          <SelectItem value="C">Permis C</SelectItem>
                          <SelectItem value="B">Permis B</SelectItem>
                          <SelectItem value="L">Permis L</SelectItem>
                          <SelectItem value="G">Permis G (frontalier)</SelectItem>
                          <SelectItem value="Ci">Permis Ci</SelectItem>
                          <SelectItem value="F">Permis F</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t("calc.global.field.civil_status")}>
                      <Select
                        value={form.civilStatus}
                        onValueChange={(v) =>
                          set("civilStatus", v as "single" | "married")
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Célibataire</SelectItem>
                          <SelectItem value="married">Marié / partenariat</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <NumField
                      label={t("calc.global.field.children")}
                      value={form.children}
                      onChange={(v) => set("children", v)}
                    />
                    <Field label={t("calc.global.field.confession")}>
                      <Select
                        value={form.confession}
                        onValueChange={(v) =>
                          set("confession", v as TaxGlobalInput["confession"])
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucune</SelectItem>
                          <SelectItem value="catholic">Catholique</SelectItem>
                          <SelectItem value="protestant">Protestant</SelectItem>
                          <SelectItem value="other">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <NumField
                      label={t("calc.global.field.age")}
                      value={form.age ?? 40}
                      onChange={(v) => set("age", v)}
                    />
                    {form.civilStatus === "married" && (
                      <Field label={t("calc.global.field.spouse_employed")}>
                        <div className="flex h-10 items-center">
                          <Switch
                            checked={form.spouseEmployed}
                            onCheckedChange={(v) => set("spouseEmployed", v)}
                          />
                        </div>
                      </Field>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="income">
                <AccordionTrigger>{t("calc.global.section.income")}</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <NumField
                      label={t("calc.global.field.gross_salary")}
                      value={form.grossSalary}
                      onChange={(v) => set("grossSalary", v)}
                      suffix="CHF"
                    />
                    <NumField
                      label={t("calc.global.field.bonus")}
                      value={form.bonus}
                      onChange={(v) => set("bonus", v)}
                      suffix="CHF"
                    />
                    {form.civilStatus === "married" && (
                      <NumField
                        label={t("calc.global.field.spouse_salary")}
                        value={form.spouseGrossSalary}
                        onChange={(v) => set("spouseGrossSalary", v)}
                        suffix="CHF"
                      />
                    )}
                    <NumField
                      label={t("calc.global.field.other_income")}
                      value={form.otherIncome}
                      onChange={(v) => set("otherIncome", v)}
                      suffix="CHF"
                    />
                    <NumField
                      label={t("calc.global.field.rental_income")}
                      value={form.rentalIncome}
                      onChange={(v) => set("rentalIncome", v)}
                      suffix="CHF"
                    />
                    <NumField
                      label={t("calc.global.field.imputed_rent")}
                      value={form.imputedRent}
                      onChange={(v) => set("imputedRent", v)}
                      suffix="CHF"
                    />
                    <NumField
                      label={t("calc.global.field.foreign_income")}
                      value={form.foreignIncome}
                      onChange={(v) => set("foreignIncome", v)}
                      suffix="CHF"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {showFortune && (
                <AccordionItem value="wealth">
                  <AccordionTrigger>{t("calc.global.section.wealth")}</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <NumField
                        label={t("calc.global.field.net_wealth")}
                        value={form.netWealth}
                        onChange={(v) => set("netWealth", v)}
                        suffix="CHF"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              <AccordionItem value="deductions">
                <AccordionTrigger>{t("calc.global.section.deductions")}</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <NumField
                      label={t("calc.global.field.pillar_3a")}
                      value={form.pillar3aContributions}
                      onChange={(v) => set("pillar3aContributions", v)}
                      suffix="CHF"
                    />
                    <NumField
                      label={t("calc.global.field.lpp_buyback")}
                      value={form.lppBuyback}
                      onChange={(v) => set("lppBuyback", v)}
                      suffix="CHF"
                    />
                    <NumField
                      label={t("calc.global.field.mortgage")}
                      value={form.mortgageInterest}
                      onChange={(v) => set("mortgageInterest", v)}
                      suffix="CHF"
                    />
                    <NumField
                      label={t("calc.global.field.maintenance")}
                      value={form.realEstateMaintenance}
                      onChange={(v) => set("realEstateMaintenance", v)}
                      suffix="CHF"
                    />
                    <NumField
                      label={t("calc.global.field.health_premiums")}
                      value={form.healthInsurancePremiums}
                      onChange={(v) => set("healthInsurancePremiums", v)}
                      suffix="CHF"
                    />
                    <NumField
                      label={t("calc.global.field.child_care")}
                      value={form.childCareCosts}
                      onChange={(v) => set("childCareCosts", v)}
                      suffix="CHF"
                    />
                    <NumField
                      label={t("calc.global.field.donations")}
                      value={form.donations}
                      onChange={(v) => set("donations", v)}
                      suffix="CHF"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {showFrontalierBlock && (
                <AccordionItem value="frontalier">
                  <AccordionTrigger>{t("calc.global.section.frontalier")}</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <NumField
                        label={t("calc.global.field.eur_chf")}
                        value={form.eurChfRate}
                        onChange={(v) => set("eurChfRate", v)}
                        step={0.01}
                      />
                      <NumField
                        label={t("calc.global.field.chf_eur")}
                        value={form.chfToEurRate}
                        onChange={(v) => set("chfToEurRate", v)}
                        step={0.01}
                      />
                      <NumField
                        label={t("calc.global.field.tax_year")}
                        value={form.taxYear}
                        onChange={(v) => set("taxYear", v)}
                      />
                      <NumField
                        label={t("calc.global.field.lamal_adult")}
                        value={form.lamalAdultMonthlyCHF}
                        onChange={(v) => set("lamalAdultMonthlyCHF", v)}
                        suffix="CHF"
                      />
                      <NumField
                        label={t("calc.global.field.lamal_child")}
                        value={form.lamalChildMonthlyCHF}
                        onChange={(v) => set("lamalChildMonthlyCHF", v)}
                        step={0.1}
                        suffix="CHF"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </CalcCard>

          {result.notes.length > 0 && (
            <CalcCard title={t("calc.global.notes.title")}>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {result.notes.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </CalcCard>
          )}
        </div>

        {/* RIGHT — Results */}
        <div className="space-y-4 lg:col-span-2">
          <CalcCard title={t("calc.global.results.title")}>
            <Row>
              <MoneyTile
                label={t("calc.global.tile.total_tax")}
                value={result.totalTaxCHF}
                tone="warning"
                big
              />
              <MoneyTile
                label={t("calc.global.tile.net")}
                value={result.netAnnualCHF}
                tone="success"
                big
              />
            </Row>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <PctTile
                label={t("calc.global.tile.effective_rate")}
                value={result.effectiveRate}
                tone="primary"
              />
              <PctTile
                label={t("calc.global.tile.marginal_rate")}
                value={result.marginalRate}
              />
            </div>
          </CalcCard>

          {/* Breakdown — ordinaire */}
          {result.income && (
            <CalcCard>
              <div className="grid grid-cols-2 gap-3">
                <MoneyTile label={t("calc.global.tile.federal")} value={result.income.ifd} />
                <MoneyTile
                  label={t("calc.global.tile.cantonal")}
                  value={result.income.cantonal + result.income.communal}
                />
                <MoneyTile
                  label={t("calc.global.tile.wealth")}
                  value={result.income.wealthTax}
                />
                <MoneyTile label="Église" value={result.income.church} />
              </div>
            </CalcCard>
          )}

          {/* Source / TOU */}
          {showTouBlock && result.source && (
            <CalcCard>
              <Row>
                <MoneyTile
                  label={t("calc.global.tile.source")}
                  value={result.source.annualTax}
                />
                <PctTile label="Taux IS" value={result.source.rate} />
              </Row>
              {result.touEligibility && (
                <div className="mt-3 rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    {result.touEligibility.eligibleForTOU ? (
                      <Badge className="bg-success text-success-foreground">
                        {t("calc.global.tou.eligible")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        {t("calc.global.tou.not_eligible")}
                      </Badge>
                    )}
                    <span className="text-muted-foreground">
                      {t("calc.global.tile.swiss_part")} : {result.touEligibility.swissShare}%
                    </span>
                  </div>
                  {result.touComparison && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {result.touComparison.recommendationText}
                    </p>
                  )}
                </div>
              )}
            </CalcCard>
          )}

          {/* Frontalier */}
          {showFrontalierBlock && result.crossBorder && (
            <CalcCard>
              <div className="grid grid-cols-2 gap-3">
                <MoneyTile
                  label={t("calc.global.tile.swiss_part")}
                  value={result.crossBorder.swissTax}
                  hint={`${result.crossBorder.swissRate}%`}
                />
                <MoneyTile
                  label={t("calc.global.tile.foreign_part")}
                  value={result.crossBorder.foreignTax}
                  hint={`${result.crossBorder.foreignRate}%`}
                />
              </div>
              {result.health && (
                <div className="mt-3 rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {t("calc.global.tile.health")} :{" "}
                      <span className="text-primary">{result.health.recommended}</span>
                    </span>
                    <span className="tabular-nums">
                      {formatCHF(result.health.recommendedAnnualCHF)}/an
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Économie vs autre option : {formatCHF(result.health.savingsCHF)}
                  </p>
                </div>
              )}
            </CalcCard>
          )}
        </div>
      </div>

      {/* SCENARIOS */}
      <CalcCard
        title={t("calc.global.scenarios.title")}
        description={t("calc.global.scenarios.desc")}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scenarios.map((s) => {
            const isBaseline = s.id === "baseline";
            const isGain = !isBaseline && s.deltaVsBaseline < 0;
            const isCost = !isBaseline && s.deltaVsBaseline > 0;
            return (
              <div
                key={s.id}
                className={`rounded-xl border p-4 transition-shadow hover-lift ${
                  isBaseline
                    ? "border-primary/50 bg-primary/5"
                    : isGain
                      ? "border-success/40 bg-success/5"
                      : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{s.label}</div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s.description}
                    </p>
                  </div>
                  {isBaseline && (
                    <Badge variant="outline" className="shrink-0">
                      Base
                    </Badge>
                  )}
                </div>
                <div className="mt-3 text-lg font-bold tabular-nums">
                  {formatCHF(s.result.totalTaxCHF)}
                </div>
                {!isBaseline && (
                  <div
                    className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${
                      isGain ? "text-success" : isCost ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {isGain ? (
                      <TrendingDown className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingUp className="h-3.5 w-3.5" />
                    )}
                    {isGain
                      ? `${t("calc.global.scenarios.saves")} ${formatCHF(Math.abs(s.deltaVsBaseline))}`
                      : `${t("calc.global.scenarios.costs")} ${formatCHF(Math.abs(s.deltaVsBaseline))}`}
                  </div>
                )}
                <div className="mt-2 text-xs text-muted-foreground">
                  Net : {formatCHF(s.result.netAnnualCHF)}
                </div>
              </div>
            );
          })}
        </div>
      </CalcCard>
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
  suffix,
  tip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
  tip?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {tip ? (
        <InfoLabel tip={tip}>{label}</InfoLabel>
      ) : (
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      )}
      <BaseNumField
        value={String(value)}
        onChange={(v) => onChange(Number(v) || 0)}
        suffix={suffix}
        step={step}
      />
    </div>
  );
}

// silence unused
void ArrowRight;
