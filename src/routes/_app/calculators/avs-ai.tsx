import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { NumField as BaseNumField } from "@/components/ui/num-field";
import { CalcCard, MoneyTile, StatTile, Row } from "@/components/calculators/CalcUI";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AVS_2026,
  getReferenceAge,
  projectAvsPension,
  type Gender,
} from "@/lib/avs";
import { GENDER_LABELS } from "@/lib/swiss/enums";
import {
  usePrefillFromClient,
  useHydrateFormFromPrefill,
} from "@/hooks/usePrefillFromClient";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { WikiTip } from "@/components/calculators/WikiTip";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useT } from "@/contexts/LanguageContext";
import { parseChildren, ageFromDob } from "@/lib/clients/types";
import { buildSurvivorBenefits } from "@/lib/avs/survivors";
import { formatCHF } from "@/lib/format";
import { CrossCalcImpactBanner } from "@/components/calculators/CrossCalcImpactBanner";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/avs-ai")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Rente AVS/AI · SwissBroker Pro" },
      {
        name: "description",
        content:
          "Estimation de la rente AVS/AI 2026 (1er pilier) : couple, plafonnement, AVS21.",
      },
    ],
  }),
  component: AvsAiCalc,
});

function AvsAiCalc() {
  const t = useT();
  const currentYear = new Date().getFullYear();
  const { clientId } = Route.useSearch();
  const { client, bundle, prefill } = usePrefillFromClient(clientId, "avs-ai");

  // Persistance localStorage en mode standalone (sans clientId) · l'utilisateur
  // ne perd plus ses saisies quand il quitte/revient au calculateur.
  const STORAGE_KEY = "avs.standalone.form.v1";
  const initialForm = (() => {
    const base = {
      birthYear: 1980,
      gender: "male" as Gender,
      contributionStartYear: 2001,
      retirementYear: 2045,
      averageAnnualIncome: 90_000,
      departureYear: 0,
      educationalYears: 0,
      educationalShare: 100,
      assistanceYears: 0,
      assistanceShare: 100,
      isCouple: false,
      spouseBirthYear: 1982,
      spouseGender: "female" as Gender,
      spouseContributionStartYear: 2005,
      spouseRetirementYear: 2046,
      spouseAverageAnnualIncome: 70_000,
    };
    if (clientId || typeof window === "undefined") return base;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...base, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return base;
  })();
  const [form, setForm] = useState<typeof initialForm>(initialForm);

  // Sauvegarde auto en mode standalone
  useEffect(() => {
    if (clientId || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {
      /* ignore */
    }
  }, [form, clientId]);

  const set = <K extends keyof typeof initialForm>(k: K, v: (typeof initialForm)[K]) =>
    setForm((f: typeof initialForm) => ({ ...f, [k]: v }));

  useHydrateFormFromPrefill(prefill, setForm);

  const refAge = getReferenceAge(form.birthYear, form.gender);
  const refAgeSpouse = getReferenceAge(form.spouseBirthYear, form.spouseGender);

  const projection = useMemo(
    () =>
      projectAvsPension({
        status: form.isCouple ? "married" : "single",
        primary: {
          birthYear: form.birthYear,
          gender: form.gender,
          contributionStartYear: form.contributionStartYear,
          retirementYear: form.retirementYear,
          averageAnnualIncome: form.averageAnnualIncome,
          departureYear: form.departureYear > 0 ? form.departureYear : null,
          educationalYears: form.educationalYears,
          educationalShare: form.educationalShare,
          assistanceYears: form.assistanceYears,
          assistanceShare: form.assistanceShare,
        },
        spouse: form.isCouple
          ? {
              birthYear: form.spouseBirthYear,
              gender: form.spouseGender,
              contributionStartYear: form.spouseContributionStartYear,
              retirementYear: form.spouseRetirementYear,
              averageAnnualIncome: form.spouseAverageAnnualIncome,
            }
          : undefined,
      }),
    [form],
  );

  const ageAtRetirement = form.retirementYear - form.birthYear;

  // ── AI (Assurance Invalidité) ──────────────────────────────────────────
  // Bonifications calculées sur l'âge ACTUEL des enfants (situation réelle au
  // moment de l'évaluation d'invalidité), pas projection future à 16 ans.
  const childrenElapsedYears = useMemo(() => {
    const kids = parseChildren(bundle?.client.children);
    if (kids.length === 0) return null;
    let total = 0;
    for (const k of kids) {
      const a = ageFromDob(k.date_of_birth);
      if (a === null) continue;
      total += Math.max(0, Math.min(16, a));
    }
    return total;
  }, [bundle]);

  // Overrides éditables (utile en mode standalone). Si client lié → préremplit.
  const [aiEduYears, setAiEduYears] = useState<number>(0);
  const [aiAssistYears, setAiAssistYears] = useState<number>(0);
  useEffect(() => {
    if (childrenElapsedYears !== null) setAiEduYears(childrenElapsedYears);
  }, [childrenElapsedYears]);
  useEffect(() => {
    setAiAssistYears(form.assistanceYears);
  }, [form.assistanceYears]);

  const aiProjection = useMemo(
    () =>
      projectAvsPension({
        status: "single",
        primary: {
          birthYear: form.birthYear,
          gender: form.gender,
          contributionStartYear: form.contributionStartYear,
          // Pour l'AI, la rente est figée sur la situation présente : on tronque
          // la carrière à l'année courante.
          retirementYear: currentYear,
          averageAnnualIncome: form.averageAnnualIncome,
          departureYear: null,
          educationalYears: aiEduYears,
          educationalShare: form.educationalShare,
          assistanceYears: aiAssistYears,
          assistanceShare: form.assistanceShare,
        },
      }),
    [form, aiEduYears, aiAssistYears, currentYear],
  );

  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: t("calc.avs.step.welcome.t"), body: t("calc.avs.step.welcome.b") },
    { target: "avs-birth-year", title: t("calc.avs.step.birth.t"), body: t("calc.avs.step.birth.b") },
    { target: "avs-gender", title: t("calc.avs.step.gender.t"), body: t("calc.avs.step.gender.b") },
    { target: "avs-contrib-start", title: t("calc.avs.step.contrib.t"), body: t("calc.avs.step.contrib.b") },
    { target: "avs-retirement-year", title: t("calc.avs.step.retirement.t"), body: t("calc.avs.step.retirement.b") },
    { target: "avs-income", title: t("calc.avs.step.income.t"), body: t("calc.avs.step.income.b") },
    { target: "avs-couple", title: t("calc.avs.step.couple.t"), body: t("calc.avs.step.couple.b") },
    { target: "avs-result", title: t("calc.avs.step.result.t"), body: t("calc.avs.step.result.b") },
  ];

  return (
    <div className="space-y-6">
      <CrossCalcImpactBanner calculator="avs-ai" clientId={clientId} />
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title={t("calc.avs.guide_title")} />
      {client && <ClientLinkBanner client={client} />}
      <div className="flex justify-end gap-2">
        <GuideToggleButton onClick={() => setGuideOpen(true)} />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="space-y-4 md:col-span-3">
          <CalcCard
            title={t("calc.avs.person_card")}
            description={t("calc.avs.refage_desc", { age: refAge })}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div data-guide="avs-birth-year">
                <NumField
                  label={t("pension.birth_year")}
                  value={form.birthYear}
                  onChange={(v) => set("birthYear", v)}
                  wikiId="avs-base"
                  wikiTip={t("calc.avs.tip.birth")}
                />
              </div>
              <div data-guide="avs-gender" className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span>{t("pension.gender")}</span>
                  <WikiTip articleId="avs-base" tip={t("calc.avs.tip.gender")} />
                </Label>
                <Select value={form.gender} onValueChange={(v) => set("gender", v as Gender)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{GENDER_LABELS.male}</SelectItem>
                    <SelectItem value="female">{GENDER_LABELS.female}</SelectItem>
                    <SelectItem value="other">{GENDER_LABELS.other}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div data-guide="avs-contrib-start">
                <NumField
                  label={t("pension.contribution_year_start")}
                  value={form.contributionStartYear}
                  onChange={(v) => set("contributionStartYear", v)}
                  wikiId="avs-base"
                  wikiTip={t("calc.avs.tip.contrib_start")}
                />
              </div>
              <div data-guide="avs-retirement-year">
                <NumField
                  label={t("pension.retirement_year_planned")}
                  value={form.retirementYear}
                  onChange={(v) => set("retirementYear", v)}
                  wikiId="avs-anticipation"
                  wikiTip={t("calc.avs.tip.retirement_year")}
                />
              </div>
              <div data-guide="avs-income">
                <NumField
                  label={t("pension.average_annual_income_career")}
                  value={form.averageAnnualIncome}
                  onChange={(v) => set("averageAnnualIncome", v)}
                  suffix="CHF"
                  wikiId="avs-base"
                  wikiTip={t("calc.avs.tip.income")}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("calc.avs.current_year", { year: currentYear, age: ageAtRetirement })}
              {ageAtRetirement < AVS_2026.referenceAgeMin ||
              ageAtRetirement > AVS_2026.referenceAgeMax ? (
                <span className="ml-1 text-warning">
                  {t("calc.avs.out_of_window", { min: AVS_2026.referenceAgeMin, max: AVS_2026.referenceAgeMax })}
                </span>
              ) : null}
            </p>
          </CalcCard>

          <CalcCard title={t("calc.avs.bonifications_card")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumField
                label={t("calc.avs.field.departure_year")}
                value={form.departureYear}
                onChange={(v) => set("departureYear", v)}
                wikiId="avs-base"
                wikiTip={t("calc.avs.tip.departure")}
              />
              <div />
              <NumField
                label={t("calc.avs.field.educational_years")}
                value={form.educationalYears}
                onChange={(v) => set("educationalYears", v)}
                wikiId="avs-base"
                wikiTip={t("calc.avs.tip.educational")}
              />
              <NumField
                label={t("calc.avs.field.educational_share")}
                value={form.educationalShare}
                onChange={(v) => set("educationalShare", v)}
                suffix="%"
                wikiId="avs-base"
                wikiTip={t("calc.avs.tip.educational_share")}
              />
              <NumField
                label={t("calc.avs.field.assistance_years")}
                value={form.assistanceYears}
                onChange={(v) => set("assistanceYears", v)}
                wikiId="avs-base"
                wikiTip={t("calc.avs.tip.assistance")}
              />
              <NumField
                label={t("calc.avs.field.assistance_share")}
                value={form.assistanceShare}
                onChange={(v) => set("assistanceShare", v)}
                suffix="%"
                wikiTip={t("calc.avs.tip.assistance_share")}
              />
            </div>
            {(form.educationalYears > 0 || form.assistanceYears > 0 || form.departureYear > 0) && (
              <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs space-y-1">
                {form.departureYear > 0 && (
                  <p>
                    {t("calc.avs.bonus_departure", {
                      year: form.departureYear,
                      effective: projection.primary.effectiveYears,
                      missing: projection.primary.missingYears,
                    })}
                  </p>
                )}
                {projection.primary.bonificationsBonus > 0 && (
                  <p>
                    {t("calc.avs.bonus_amount", {
                      bonus: projection.primary.bonificationsBonus,
                      income: projection.primary.determiningIncome,
                    })}
                    {form.averageAnnualIncome >= AVS_2026.maxDeterminingIncome && (
                      <span className="ml-1 text-warning">
                        {" "}
                        {t("calc.avs.bonus_capped", { cap: AVS_2026.maxDeterminingIncome })}
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}
          </CalcCard>

          <div data-guide="avs-couple"><CalcCard title={t("calc.avs.spouse_card")}>
            <label className="mb-3 flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isCouple}
                onCheckedChange={(v) => set("isCouple", Boolean(v))}
              />
              {t("calc.avs.couple_checkbox", { ceiling: AVS_2026.maxCoupleMonthlyPension })}
            </label>
            {form.isCouple && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumField
                  label={t("pension.birth_year")}
                  value={form.spouseBirthYear}
                  onChange={(v) => set("spouseBirthYear", v)}
                />
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">{t("pension.gender")}</Label>
                  <Select value={form.spouseGender} onValueChange={(v) => set("spouseGender", v as Gender)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{GENDER_LABELS.male}</SelectItem>
                      <SelectItem value="female">{GENDER_LABELS.female}</SelectItem>
                      <SelectItem value="other">{GENDER_LABELS.other}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumField
                  label={t("pension.contribution_year_start")}
                  value={form.spouseContributionStartYear}
                  onChange={(v) => set("spouseContributionStartYear", v)}
                />
                <NumField
                  label={t("pension.retirement_year")}
                  value={form.spouseRetirementYear}
                  onChange={(v) => set("spouseRetirementYear", v)}
                />
                <NumField
                  label={t("pension.average_annual_income")}
                  value={form.spouseAverageAnnualIncome}
                  onChange={(v) => set("spouseAverageAnnualIncome", v)}
                  suffix="CHF"
                />
                <p className="col-span-full text-xs text-muted-foreground">
                  {t("calc.avs.spouse_ref_age", { age: refAgeSpouse })}
                </p>
              </div>
            )}
          </CalcCard></div>
        </div>

        <div className="space-y-4 md:col-span-2">
          <div data-guide="avs-result"><CalcCard title={t("calc.avs.result_card")} tilt>
            {form.isCouple && projection.combinedMonthlyPension !== undefined ? (
              <Row>
                <MoneyTile label={t("calc.avs.couple_pension_month")} value={projection.combinedMonthlyPension} tone="primary" big />
                <MoneyTile label={t("calc.avs.couple_pension_year")} value={projection.combinedAnnualPension} tone="success" />
              </Row>
            ) : (
              <Row>
                <MoneyTile label={t("calc.avs.pension_month")} value={projection.primary.monthlyPension} tone="primary" big />
                <MoneyTile label={t("calc.avs.pension_year")} value={projection.primary.annualPension} tone="success" />
              </Row>
            )}
            {projection.cappedCouple ? (
              <p className="mt-3 rounded-md bg-warning/10 p-2 text-xs text-warning-foreground">
                {t("calc.avs.capped_warning", { ceiling: AVS_2026.maxCoupleMonthlyPension })}
              </p>
            ) : null}
          </CalcCard></div>

          <CalcCard title={t("calc.avs.detail_person_card")}>
            <Row>
              <StatTile label={t("calc.avs.years_paid")} value={`${projection.primary.effectiveYears} / ${AVS_2026.fullContributionYears}`} />
              <StatTile label={t("calc.avs.years_missing")} value={String(projection.primary.missingYears)} tone={projection.primary.missingYears > 0 ? "warning" : "default"} />
            </Row>
            <Row>
              <MoneyTile label={t("calc.avs.theoretical_full")} value={projection.primary.theoreticalAnnualPension} />
              <StatTile label={t("calc.avs.scale")} value={`${(projection.primary.reductionRatio * 100).toFixed(1)} %`} hint={t("calc.avs.scale_hint")} />
            </Row>
          </CalcCard>

          <CalcCard
            title={t("calc.ai.card_title")}
            description={t("calc.ai.card_desc")}
          >
            <Row>
              <MoneyTile
                label={t("calc.ai.pension_month")}
                value={aiProjection.primary.monthlyPension}
                tone="primary"
                big
              />
              <MoneyTile
                label={t("calc.ai.pension_year")}
                value={aiProjection.primary.annualPension}
                tone="success"
              />
            </Row>
            <Row>
              <StatTile
                label={t("calc.ai.scale")}
                value={`${aiProjection.primary.effectiveYears} / ${AVS_2026.fullContributionYears}`}
                hint={t("calc.ai.scale_hint")}
              />
              <MoneyTile
                label={t("calc.ai.theoretical_full")}
                value={aiProjection.primary.theoreticalAnnualPension}
              />
            </Row>
            <div className="mt-3 space-y-2 rounded-md bg-muted/40 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("calc.ai.bonifs_title")}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <NumField
                  label={t("calc.ai.field.edu_years")}
                  value={aiEduYears}
                  onChange={setAiEduYears}
                  wikiTip={t("calc.ai.tip.edu_years")}
                />
                <NumField
                  label={t("calc.ai.field.assist_years")}
                  value={aiAssistYears}
                  onChange={setAiAssistYears}
                  wikiTip={t("calc.ai.tip.assist_years")}
                />
              </div>
              {childrenElapsedYears !== null && (
                <p className="text-[11px] text-muted-foreground">
                  {t("calc.ai.children_note", { years: childrenElapsedYears })}
                </p>
              )}
              <p className="text-[11px] text-foreground/80">
                {t("calc.ai.bonifs_amount", {
                  bonus: aiProjection.primary.bonificationsBonus,
                  income: aiProjection.primary.determiningIncome,
                })}
              </p>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              {t("calc.ai.disclaimer")}
            </p>
          </CalcCard>

          <SurvivorCard
            theoreticalAnnual={projection.primary.theoreticalAnnualPension}
            hasSurvivingSpouse={form.isCouple}
            childrenCount={parseChildren(bundle?.client?.children).length}
          />


          {form.isCouple && projection.spouse && (
            <CalcCard title={t("calc.avs.detail_spouse_card")}>
              <Row>
                <StatTile label={t("calc.avs.years_paid")} value={`${projection.spouse.effectiveYears} / ${AVS_2026.fullContributionYears}`} />
                <MoneyTile label={t("calc.avs.spouse_individual_pension")} value={projection.spouse.monthlyPension} />
              </Row>
            </CalcCard>
          )}
        </div>
      </div>

      <CalcCard title={t("calc.avs.methodology_card")}>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li>• {t("calc.avs.method_1", { min: AVS_2026.minMonthlyPension, max: AVS_2026.maxMonthlyPension })}</li>
          <li>• {t("calc.avs.method_2")}</li>
          <li>• {t("calc.avs.method_3")}</li>
          <li>• {t("calc.avs.method_4")}</li>
        </ul>
        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
          <p className="font-medium text-foreground">{t("calc.avs.ci_title")}</p>
          <p className="mt-1 text-muted-foreground">{t("calc.avs.ci_desc")}</p>
          <a
            href="https://www.ahv-iv.ch/fr/Formulaires/Demande-dextrait-de-compte"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-primary underline hover:no-underline"
          >
            {t("calc.avs.ci_link")}
          </a>
          <p className="mt-2 text-muted-foreground">{t("calc.avs.ci_docs")}</p>
        </div>
      </CalcCard>
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

function SurvivorCard({
  theoreticalAnnual,
  hasSurvivingSpouse,
  childrenCount,
}: {
  theoreticalAnnual: number;
  hasSurvivingSpouse: boolean;
  childrenCount: number;
}) {
  const survivors = useMemo(
    () =>
      buildSurvivorBenefits({
        deceasedTheoreticalAnnual: theoreticalAnnual,
        hasSurvivingSpouse,
        childrenCount,
      }),
    [theoreticalAnnual, hasSurvivingSpouse, childrenCount],
  );

  if (!hasSurvivingSpouse && childrenCount === 0) {
    return (
      <CalcCard
        title="Décès, Rentes de survivants"
        description="Indiquez un conjoint ou des enfants pour estimer les rentes de survivants."
      >
        <p className="text-xs text-muted-foreground">
          Rente théorique vieillesse du défunt : {formatCHF(theoreticalAnnual)} / an.
        </p>
      </CalcCard>
    );
  }

  return (
    <CalcCard
      title="Décès, Rentes de survivants AVS"
      description="Veuf/veuve 80% · Orphelin 40% (60% si double). Plafond familial 150%."
    >
      <Row>
        <MoneyTile
          label="Total mensuel"
          value={survivors.totalMonthly}
          tone="primary"
          big
        />
        <MoneyTile label="Total annuel" value={survivors.totalAnnual} tone="success" />
      </Row>
      <div className="mt-3 space-y-1.5 rounded-md border border-border/60 p-2 text-xs">
        {survivors.widow && (
          <div className="flex justify-between">
            <span className="text-foreground/80">{survivors.widow.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatCHF(survivors.widow.annual)} ({formatCHF(survivors.widow.monthly)} / mois)
            </span>
          </div>
        )}
        {survivors.orphans.map((o, i) => (
          <div key={i} className="flex justify-between">
            <span className="text-foreground/80">{o.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatCHF(o.annual)} ({formatCHF(o.monthly)} / mois)
            </span>
          </div>
        ))}
      </div>
      {survivors.cappedFamily && (
        <p className="mt-2 rounded-md bg-warning/10 p-2 text-[11px] text-warning-foreground">
          Plafond familial 150 % appliqué (réduction proportionnelle).
        </p>
      )}
    </CalcCard>
  );
}

