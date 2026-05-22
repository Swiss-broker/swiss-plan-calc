import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Sparkles, Info, ArrowRight } from "lucide-react";

import { CalcCard, MoneyTile, PctTile, Row, InfoLabel, HelpDot } from "@/components/calculators/CalcUI";
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
import { Pillar3bInfoTile } from "@/components/optimizer/OptimizationsPanel";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { TaxGlobalExplanation } from "@/components/calculators/TaxGlobalExplanation";
import { TaxGlobalCompareCard } from "@/components/calculators/TaxGlobalCompareCard";

import { CANTONS } from "@/lib/swiss/cantons";
import { formatCHF } from "@/lib/format";
import { useT } from "@/contexts/LanguageContext";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";

import { computeTaxGlobal } from "@/lib/tax-global/engine";

import { createDefaultInput } from "@/lib/tax-global/profile";
import type { TaxGlobalInput } from "@/lib/tax-global/types";
import { SUPPORTED_CURRENCIES, getAfcRate, type Currency } from "@/lib/fx/sources";
import { fetchMarketRates } from "@/lib/fx/fetch.functions";


type FxCurrency = "CHF" | Currency;

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/tax-global")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Calculateur Fiscal Global, SwissBroker Pro" }] }),
  component: TaxGlobalCalc,
});

function TaxGlobalCalc() {
  const t = useT();
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "tax-global");

  const [form, setForm] = useState<TaxGlobalInput>(() => createDefaultInput());
  useHydrateFormFromPrefill(
    prefill as Partial<Record<string, unknown>> | null,
    setForm as unknown as (
      updater: (prev: Record<string, unknown>) => Record<string, unknown>,
    ) => void,
  );

  const set = <K extends keyof TaxGlobalInput>(k: K, v: TaxGlobalInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const result = useMemo(() => computeTaxGlobal(form), [form]);
  

  // ── Conversion devise pour revenus étrangers ──
  const [fxCurrency, setFxCurrency] = useState<FxCurrency>("CHF");
  const [fxAmount, setFxAmount] = useState<number>(0);
  const [fxSource, setFxSource] = useState<"afc" | "market">("afc");
  const [fxMarketRate, setFxMarketRate] = useState<number | null>(null);
  const [fxMarketDate, setFxMarketDate] = useState<string | null>(null);
  const [fxMarketLoading, setFxMarketLoading] = useState(false);

  const fxRate: number | null = useMemo(() => {
    if (fxCurrency === "CHF") return 1;
    if (fxSource === "afc") return getAfcRate(form.taxYear, fxCurrency);
    return fxMarketRate;
  }, [fxCurrency, fxSource, fxMarketRate, form.taxYear]);

  // Recharge le taux marché à la demande (devise ou source change).
  useEffect(() => {
    if (fxCurrency === "CHF" || fxSource !== "market") return;
    let cancelled = false;
    setFxMarketLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    fetchMarketRates({ data: { dates: [today], currency: fxCurrency } })
      .then((rates) => {
        if (cancelled) return;
        const r = rates[0];
        setFxMarketRate(r?.rate ?? null);
        setFxMarketDate(r?.effectiveDate ?? r?.date ?? today);
      })
      .catch(() => {
        if (!cancelled) {
          setFxMarketRate(null);
          setFxMarketDate(null);
        }
      })
      .finally(() => {
        if (!cancelled) setFxMarketLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fxCurrency, fxSource]);

  // Synchronise foreignIncome (toujours en CHF dans le moteur).
  useEffect(() => {
    const chf = fxCurrency === "CHF"
      ? Math.round(fxAmount)
      : fxRate && fxAmount
        ? Math.round((fxCurrency === "JPY" ? fxAmount / 100 : fxAmount) * fxRate)
        : 0;
    if (chf !== form.foreignIncome) {
      set("foreignIncome", chf);
    }
  }, [fxAmount, fxRate, fxCurrency]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectableCantons = CANTONS.filter((c) => c.selectable);
  const showFortune = result.regime === "resident_ordinary";
  const showFrontalierBlock =
    result.regime === "cross_border_ge" ||
    result.regime === "cross_border_fr_1983" ||
    result.regime === "cross_border_other";
  const showTouBlock = result.regime === "source_taxed" || result.regime === "tou";
  const isFrontalier = showFrontalierBlock;
  const isCouple = form.civilStatus === "married" || form.civilStatus === "registered_partnership";
  const isCohabiting = form.civilStatus === "cohabiting";

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
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                <span className="opacity-80">{t("calc.global.regime.detected")} :</span>
                <span>{result.regimeLabel}</span>
              </div>
              {isFrontalier && (
                <Badge className="bg-amber-400 text-amber-950 hover:bg-amber-400/90">
                  🇫🇷→🇨🇭 {t("calc.global.badge.frontalier")}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CalcCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* LEFT, Fiche client */}
        <div className="space-y-4 lg:col-span-3">
          <CalcCard>
            <Accordion type="multiple" defaultValue={["identity", "income"]}>
              <AccordionItem value="identity">
                <AccordionTrigger>{t("calc.global.section.identity")}</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={t("calc.global.field.canton")}>
                      <Select value={form.canton} onValueChange={(v) => set("canton", v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {selectableCantons.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.code} {c.name}
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
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
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
                        onValueChange={(v) => set("permit", v as TaxGlobalInput["permit"])}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
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
                          set("civilStatus", v as TaxGlobalInput["civilStatus"])
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">{t("enum.civil_status.single")}</SelectItem>
                          <SelectItem value="married">{t("enum.civil_status.married")}</SelectItem>
                          <SelectItem value="registered_partnership">
                            {t("enum.civil_status.registered_partnership")}
                          </SelectItem>
                          <SelectItem value="cohabiting">
                            {t("enum.civil_status.cohabiting")}
                          </SelectItem>
                          <SelectItem value="divorced">
                            {t("enum.civil_status.divorced")}
                          </SelectItem>
                          <SelectItem value="separated">
                            {t("enum.civil_status.separated")}
                          </SelectItem>
                          <SelectItem value="widowed">{t("enum.civil_status.widowed")}</SelectItem>
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
                        onValueChange={(v) => set("confession", v as TaxGlobalInput["confession"])}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
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
                    {isCouple && (
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
                  {isCohabiting && (
                    <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
                      {t("calc.global.note.cohabiting")}
                    </p>
                  )}
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
                      tip="Salaire annuel brut figurant sur le certificat de salaire (case 1/8), avant déductions sociales (AVS, AI, AC, LPP)."
                    />
                    <NumField
                      label={t("calc.global.field.bonus")}
                      value={form.bonus}
                      onChange={(v) => set("bonus", v)}
                      suffix="CHF"
                      tip="Gratifications, 13e salaire, part variable. Imposés comme le salaire ordinaire."
                    />
                    {isCouple && (
                      <NumField
                        label={t("calc.global.field.spouse_salary")}
                        value={form.spouseGrossSalary}
                        onChange={(v) => set("spouseGrossSalary", v)}
                        suffix="CHF"
                        tip="Salaire brut annuel du conjoint. Cumulé au revenu du ménage en taxation ordinaire."
                      />
                    )}
                    <NumField
                      label={t("calc.global.field.other_income")}
                      value={form.otherIncome}
                      onChange={(v) => set("otherIncome", v)}
                      suffix="CHF"
                      tip="Revenus accessoires : jetons de présence, indemnités, activité indépendante secondaire, rentes imposables. S'ajoutent au revenu brut."
                    />
                    <NumField
                      label={t("calc.global.field.rental_income")}
                      value={form.rentalIncome}
                      onChange={(v) => set("rentalIncome", v)}
                      suffix="CHF"
                      tip="Loyers nets perçus d'immeubles loués (avant entretien et intérêts hypothécaires, qui se déclarent en déductions). S'ajoutent au revenu imposable."
                    />
                    <NumField
                      label={t("calc.global.field.imputed_rent")}
                      value={form.imputedRent}
                      onChange={(v) => set("imputedRent", v)}
                      suffix="CHF"
                      tip="Valeur locative, revenu fictif imposé aux propriétaires occupant leur logement en Suisse (art. 21 LIFD). Représente le loyer théorique qu'ils paieraient en louant. Incluse dans le revenu imposable mais PAS dans le cash réel."
                    />

                    {/* ── Revenus étrangers avec conversion devise ── */}
                    <div className="sm:col-span-2 space-y-2 rounded-md border border-border/50 bg-muted/20 p-3">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs font-semibold">
                          {t("calc.global.field.foreign_income")}
                        </Label>
                        <HelpDot tip="Revenus de source étrangère (salaire, dividendes, loyers d'immeubles hors CH). En Suisse, ils sont exonérés mais retenus pour la PROGRESSIVITÉ du taux d'imposition (méthode d'exemption avec réserve de progressivité, art. 7 LIFD). À convertir en CHF au taux AFC de l'année fiscale." />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">Devise</Label>
                          <Select
                            value={fxCurrency}
                            onValueChange={(v) => setFxCurrency(v as FxCurrency)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CHF">CHF</SelectItem>
                              {SUPPORTED_CURRENCIES.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <NumField
                          label={`Montant${fxCurrency === "JPY" ? " (JPY)" : ""}`}
                          value={fxAmount}
                          onChange={setFxAmount}
                          suffix={fxCurrency}
                        />
                        {fxCurrency !== "CHF" && (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">
                              Source du taux
                            </Label>
                            <Select
                              value={fxSource}
                              onValueChange={(v) => setFxSource(v as "afc" | "market")}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="afc">
                                  AFC officiel {form.taxYear}
                                </SelectItem>
                                <SelectItem value="market">Marché du jour</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      {fxCurrency !== "CHF" && (
                        <p className="text-xs text-muted-foreground">
                          {fxRate == null ? (
                            fxSource === "afc" ? (
                              <span className="text-amber-600">
                                ⚠️ Taux AFC non publié pour {fxCurrency} en {form.taxYear}. Sélectionnez « Marché du jour ».
                              </span>
                            ) : fxMarketLoading ? (
                              "Chargement du taux marché…"
                            ) : (
                              <span className="text-amber-600">⚠️ Taux marché indisponible.</span>
                            )
                          ) : (
                            <>
                              → <strong className="text-foreground">{formatCHF(form.foreignIncome)}</strong>{" "}
                              <span className="opacity-70">
                                (taux {fxRate.toFixed(4)}
                                {fxCurrency === "JPY" && " / 100 JPY"} ·{" "}
                                {fxSource === "afc"
                                  ? `AFC ${form.taxYear}`
                                  : `marché ${fxMarketDate ?? ""}`})
                              </span>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ── Totaux cumulés ── */}
                  <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3">
                    <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                      <span className="text-sm font-semibold">Revenu brut total (CH)</span>
                      <span className="text-base font-bold tabular-nums">
                        {formatCHF(
                          form.grossSalary +
                            form.bonus +
                            (isCouple ? form.spouseGrossSalary : 0) +
                            form.otherIncome +
                            form.rentalIncome,
                        )}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      <li className="flex justify-between"><span>Salaire principal</span><span className="tabular-nums">{formatCHF(form.grossSalary)}</span></li>
                      {form.bonus > 0 && <li className="flex justify-between"><span>+ Bonus / 13e</span><span className="tabular-nums">{formatCHF(form.bonus)}</span></li>}
                      {isCouple && form.spouseGrossSalary > 0 && <li className="flex justify-between"><span>+ Salaire conjoint</span><span className="tabular-nums">{formatCHF(form.spouseGrossSalary)}</span></li>}
                      {form.otherIncome > 0 && <li className="flex justify-between"><span>+ Autres revenus</span><span className="tabular-nums">{formatCHF(form.otherIncome)}</span></li>}
                      {form.rentalIncome > 0 && <li className="flex justify-between"><span>+ Revenus locatifs</span><span className="tabular-nums">{formatCHF(form.rentalIncome)}</span></li>}
                      {form.imputedRent > 0 && (
                        <li className="flex justify-between italic">
                          <span>+ Valeur locative <span className="opacity-60">(imposable, hors cash)</span></span>
                          <span className="tabular-nums">{formatCHF(form.imputedRent)}</span>
                        </li>
                      )}
                      {form.foreignIncome > 0 && (
                        <li className="flex justify-between italic">
                          <span>
                            + Revenus étrangers{" "}
                            <span className="opacity-60">
                              (progressivité uniquement{fxCurrency !== "CHF" && fxAmount > 0 ? ` · ${fxAmount.toLocaleString("fr-CH")} ${fxCurrency}` : ""})
                            </span>
                          </span>
                          <span className="tabular-nums">{formatCHF(form.foreignIncome)}</span>
                        </li>
                      )}
                    </ul>
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
                  <div className="space-y-4">
                    {/* Bannière régime : explique l'effet réel des déductions */}
                    {(() => {
                      const reg = result.regime;
                      if (reg === "cross_border_fr_1983") {
                        return (
                          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                            <strong>Accord 1983, imposition exclusive en France.</strong> Le 3a, le rachat LPP, l'entretien immobilier CH et les primes LAMal CH <strong>ne sont pas déductibles</strong>. Seuls les intérêts d'emprunt résidence principale FR, les frais de garde et les dons réduisent l'assiette française. Vérifiez chaque bulle ci-dessous.
                          </div>
                        );
                      }
                      if (reg === "cross_border_ge" || reg === "cross_border_other") {
                        return (
                          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
                            <strong>Frontalier, déductions CH appliquées via TOU / rectification IS.</strong> Sans démarche auprès de l'AFC, l'impôt à la source reste calculé sur le brut. La simulation ci-dessous montre l'effet POTENTIEL des déductions si la démarche est effectuée.
                          </div>
                        );
                      }
                      if (reg === "source_taxed") {
                        return (
                          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
                            <strong>Imposé à la source, déductions appliquées via TOU (si quasi-résident ≥ 90 % revenus CH) ou rectification IS.</strong> Sans démarche, la retenue source brute s'applique. La simulation montre l'effet réel post-démarche.
                          </div>
                        );
                      }
                      if (reg === "tou") {
                        return (
                          <div className="rounded-md border border-success/40 bg-success/5 p-3 text-xs text-success">
                            <strong>Quasi-résident éligible TOU.</strong> Les déductions saisies s'appliquent sur demande de Taxation Ordinaire Ultérieure (à déposer avant le 31 mars de l'année suivante).
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <NumField
                        label={t("calc.global.field.pillar_3a")}
                        value={form.pillar3aContributions}
                        onChange={(v) => set("pillar3aContributions", v)}
                        suffix="CHF"
                        tip={deductionTip(result.regime, "pillar3a")}
                      />
                      <NumField
                        label={t("calc.global.field.lpp_buyback")}
                        value={form.lppBuyback}
                        onChange={(v) => set("lppBuyback", v)}
                        suffix="CHF"
                        tip={deductionTip(result.regime, "lpp")}
                      />
                      <NumField
                        label={t("calc.global.field.mortgage")}
                        value={form.mortgageInterest}
                        onChange={(v) => set("mortgageInterest", v)}
                        suffix="CHF"
                        tip={deductionTip(result.regime, "mortgage")}
                      />
                      <NumField
                        label={t("calc.global.field.maintenance")}
                        value={form.realEstateMaintenance}
                        onChange={(v) => set("realEstateMaintenance", v)}
                        suffix="CHF"
                        tip={deductionTip(result.regime, "maintenance")}
                      />
                      <NumField
                        label={t("calc.global.field.health_premiums")}
                        value={form.healthInsurancePremiums}
                        onChange={(v) => set("healthInsurancePremiums", v)}
                        suffix="CHF"
                        tip={deductionTip(result.regime, "health")}
                      />
                      <NumField
                        label={t("calc.global.field.child_care")}
                        value={form.childCareCosts}
                        onChange={(v) => set("childCareCosts", v)}
                        suffix="CHF"
                        tip={deductionTip(result.regime, "childcare")}
                      />
                      <NumField
                        label="Cotisations 3e pilier B (assurance-vie / épargne libre)"
                        value={form.pillar3bContributions}
                        onChange={(v) => set("pillar3bContributions", v)}
                        suffix="CHF"
                        tip={deductionTip(result.regime, "pillar3b")}
                      />
                      <NumField
                        label={t("calc.global.field.donations")}
                        value={form.donations}
                        onChange={(v) => set("donations", v)}
                        suffix="CHF"
                        tip={deductionTip(result.regime, "donations")}
                      />
                    </div>
                    <Pillar3bInfoTile
                      canton={form.canton}
                      civilStatus={form.civilStatus}
                      taxStatus={result.regime}
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
                        onChange={(v) => {
                          const eurChf = v || 0.95;
                          setForm((f) => ({
                            ...f,
                            eurChfRate: eurChf,
                            // Maintien automatique de la cohérence :
                            // 1 EUR = X CHF  ⇒  1 CHF = 1/X EUR
                            chfToEurRate: eurChf > 0
                              ? Math.round((1 / eurChf) * 10000) / 10000
                              : f.chfToEurRate,
                          }));
                        }}
                        step={0.01}
                        tip="1 EUR = X CHF. La valeur 1 CHF = X EUR est dérivée automatiquement."
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

        {/* RIGHT, Results */}
        <div className="space-y-4 lg:col-span-2">
          <CalcCard title={t("calc.global.results.title")}>
            <Row>
              <MoneyTile
                label={t("calc.global.tile.total_tax")}
                value={result.totalTaxCHF}
                tone="warning"
                big
                tip="Somme de l'impôt fédéral direct (IFD), cantonal, communal, ecclésiastique et, pour résident, impôt sur la fortune. N'inclut PAS les charges sociales (LAMal/CMU). Voir le panneau « Comment ce résultat est calculé » pour la chaîne complète."
              />
              <MoneyTile
                label={t("calc.global.tile.net")}
                value={result.netAnnualCHF}
                tone="success"
                big
                tip="Revenu brut − impôt total − charges sociales (LAMal/CMU pour frontalier). La valeur locative est exclue (revenu fictif, pas du cash)."
              />
            </Row>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <PctTile
                label={t("calc.global.tile.effective_rate")}
                value={result.effectiveRate}
                tone="primary"
                tip="Impôt total ÷ revenu brut. Taux moyen réellement payé sur l'ensemble du revenu."
              />
              <PctTile
                label={t("calc.global.tile.marginal_rate")}
                value={result.marginalRate}
                tip="Taux d'imposition du prochain franc gagné. Sert à chiffrer l'économie d'une déduction : économie ≈ déduction × taux marginal."
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {isFrontalier && (
                <>
                  <MoneyTile
                    label={t("calc.global.tile.swiss_part")}
                    value={result.swissShareCHF}
                    tip="Impôt prélevé en Suisse (retenue à la source, ou taxation ordinaire CH si TOU/rectification IS activée)."
                  />
                  <MoneyTile
                    label={t("calc.global.tile.foreign_part")}
                    value={result.foreignShareCHF}
                    tip="Estimation du résidu d'impôt côté pays de résidence APRÈS application du crédit d'impôt (méthode du taux effectif). Hors GE et accord 1983, varie selon le pays."
                  />
                </>
              )}
              {result.socialChargesCHF > 0 && (
                <MoneyTile
                  label={t("calc.global.tile.social")}
                  value={result.socialChargesCHF}
                  tone="warning"
                  tip="Charges santé annuelles : CMU (8% du revenu fiscal de référence FR) ou LAMal (primes mensuelles × 12 × nb assurés). L'option recommandée minimise ce coût."
                />
              )}
              <MoneyTile
                label={t("calc.global.tile.gross")}
                value={result.grossIncomeCHF}
                tip="Revenu brut de référence utilisé pour les taux. Salaire + bonus + (conjoint si couple) + autres revenus + loyer perçu. Valeur locative et revenus étrangers exclus."
              />
            </div>
          </CalcCard>

          {/* Breakdown, ordinaire */}
          {result.income && (
            <CalcCard>
              <div className="grid grid-cols-2 gap-3">
                <MoneyTile
                  label={t("calc.global.tile.federal")}
                  value={result.income.ifd}
                  tip="Impôt fédéral direct (LIFD art. 36). Barème progressif fédéral appliqué au revenu imposable IFD, après déduction enfants (6 700 CHF / enfant) et rabais 259 CHF / enfant."
                />
                <MoneyTile
                  label={t("calc.global.tile.cantonal")}
                  value={result.income.cantonal + result.income.communal}
                  tip={`Impôt cantonal + communal. Barème du canton ${form.canton} × coefficient cantonal × multiplicateur communal (chef-lieu par défaut tant que la commune réelle n'est pas résolue).`}
                />
                <MoneyTile
                  label={t("calc.global.tile.wealth")}
                  value={result.income.wealthTax}
                  tip="Impôt sur la fortune nette (immobilier + titres + bancaire + véhicules − dettes). Seuils d'exonération et barèmes cantonaux. Uniquement résident ordinaire."
                />
                <MoneyTile
                  label="Église"
                  value={result.income.church}
                  tip="Impôt ecclésiastique cantonal, appliqué uniquement si la confession est catholique ou protestante. Taux variable par canton (généralement 5–15 % de l'impôt cantonal)."
                />
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
                  tip="Retenue à la source annuelle = (salaire mensuel × taux IS du barème) × 12. Barème déterminé par statut civil, conjoint actif et confession."
                />
                <PctTile
                  label="Taux IS"
                  value={result.source.rate}
                  tip="Taux moyen du barème IS appliqué, le marginal réel dépend du barème détaillé du canton de travail."
                />
              </Row>
              {result.touEligibility && (
                <div className="mt-3 rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    {result.touEligibility.eligibleForTOU ? (
                      <Badge className="bg-success text-success-foreground">
                        {t("calc.global.tou.eligible")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{t("calc.global.tou.not_eligible")}</Badge>
                    )}
                    <span className="text-muted-foreground">
                      {t("calc.global.tile.swiss_part")} : {result.touEligibility.swissShare}%
                    </span>
                    <HelpDot tip="Quasi-résident = ≥ 90 % du revenu mondial gagné en CH. Seuil requis pour demander la TOU (Taxation Ordinaire Ultérieure), qui permet d'appliquer toutes les déductions effectives (3a, rachat LPP, intérêts hypothécaires, etc.) en remplacement de la retenue source." />
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
                  tip={
                    result.regime === "cross_border_fr_1983"
                      ? "Retenue suisse forfaitaire de 4.5 % du brut (accord 1983), intégralement rétrocédée à la France."
                      : "Impôt à la source genevois (barème A/B + réduction enfants), OU impôt ordinaire CH avec déductions si TOU GE activée et plus avantageux."
                  }
                />
                <MoneyTile
                  label={t("calc.global.tile.foreign_part")}
                  value={result.crossBorder.foreignTax}
                  hint={`${result.crossBorder.foreignRate}%`}
                  tip={
                    result.regime === "cross_border_fr_1983"
                      ? "Impôt FR au barème progressif sur (brut × 0.9 − déductions FR-éligibles), avec quotient familial. Crédit d'impôt évite la double imposition."
                      : "GE : impôt FR ramené à 0 (taux effectif côté FR, imposition principale en CH). Hors GE / accord 1983 : varie selon le pays."
                  }
                />
              </div>
              {result.health && (
                <div className="mt-3 rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-semibold">
                      {t("calc.global.tile.health")} :{" "}
                      <span className="text-primary">{result.health.recommended}</span>
                      <HelpDot tip="Comparaison automatique CMU (8 % du revenu fiscal FR) vs LAMal (primes mensuelles × 12 × assurés). L'option affichée est celle qui minimise le coût annuel." />
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

      {/* COMPARATEUR Actuel vs Projeté */}
      <TaxGlobalCompareCard form={form} result={result} />

      {/* TRANSPARENCE : comment ce résultat est calculé */}
      <TaxGlobalExplanation form={form} result={result} client={client} />


      <div className="flex flex-wrap justify-end gap-2">
        <SaveSimulationButton
          kind="tax_global"
          inputs={form as unknown as Record<string, unknown>}
          summary={{
            regime: result.regime,
            regimeLabel: result.regimeLabel,
            totalTaxCHF: result.totalTaxCHF,
            netAnnualCHF: result.netAnnualCHF,
            effectiveRate: result.effectiveRate,
            marginalRate: result.marginalRate,
            swissShareCHF: result.swissShareCHF,
            foreignShareCHF: result.foreignShareCHF,
            socialChargesCHF: result.socialChargesCHF,
          }}
          defaultTitle={`Fiscal global ${form.canton} · ${result.regimeLabel}`}
        />
      </div>
    </div>
  );
}

/** Tooltip dynamique pour chaque déduction selon le régime fiscal détecté. */
function deductionTip(
  regime: string,
  kind:
    | "pillar3a"
    | "lpp"
    | "mortgage"
    | "maintenance"
    | "health"
    | "childcare"
    | "pillar3b"
    | "donations",
): React.ReactNode {
  const ch = {
    pillar3a: "3e pilier A, plafond 2026 : 7 258 CHF (affilié LPP) ou 36 288 CHF (non-affilié, max 20 % du revenu).",
    lpp: "Rachat LPP, déduit du revenu imposable l'année du versement. Blocage 3 ans avant tout retrait en capital (art. 79b LPP).",
    mortgage: "Intérêts hypothécaires, entièrement déductibles du revenu imposable.",
    maintenance: "Frais d'entretien immobilier, soit forfait 10–20 % de la valeur locative/loyer, soit frais réels.",
    health: "Primes LAMal + LCA, déductibles dans la limite du forfait cantonal (variable, ex : 2 400 CHF célib. GE / 4 800 CHF couple).",
    childcare: "Frais de garde, max 25 500 CHF/enfant côté IFD, plafonds cantonaux variables.",
    pillar3b: "3e pilier B (assurance-vie / épargne libre), agrégé aux primes santé, déductible dans le plafond commun cantonal.",
    donations: "Dons à organismes d'utilité publique, déductibles jusqu'à 20 % du revenu net.",
  }[kind];

  if (regime === "resident_ordinary" || regime === "tou") {
    return <span>✅ Déductible intégralement. {ch}</span>;
  }
  if (regime === "source_taxed") {
    return (
      <span>
        ⚠️ <strong>Non automatique en IS.</strong> Pour appliquer : demander la TOU (si quasi-résident ≥ 90 % revenus CH) ou une rectification IS auprès de l'AFC. {ch}
      </span>
    );
  }
  if (regime === "cross_border_ge" || regime === "cross_border_other") {
    if (kind === "mortgage" || kind === "childcare" || kind === "donations") {
      return (
        <span>
          ⚠️ <strong>Côté FR :</strong> déductible de l'assiette française (impact direct sur l'impôt FR).<br />
          ⚠️ <strong>Côté CH :</strong> appliqué uniquement via TOU GE ou rectification IS. {ch}
        </span>
      );
    }
    return (
      <span>
        ⚠️ <strong>Frontalier GE :</strong> déductible uniquement via démarche TOU ou rectification IS auprès de l'AFC. Sans démarche, aucun effet sur l'IS. Non déductible côté FR. {ch}
      </span>
    );
  }
  if (regime === "cross_border_fr_1983") {
    if (kind === "mortgage" || kind === "childcare" || kind === "donations") {
      return (
        <span>
          ✅ <strong>Déductible côté France</strong> (intérêts résidence principale FR, garde, dons à organismes FR). Réduit directement l'assiette du barème français.
        </span>
      );
    }
    return (
      <span>
        ❌ <strong>NON déductible</strong> sous accord 1983 (imposition exclusive France). La saisie est ignorée par le moteur. {ch}
      </span>
    );
  }
  return ch;
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
