import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  const currentYear = new Date().getFullYear();
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "avs-ai");

  const [form, setForm] = useState({
    // Personne 1
    birthYear: 1980,
    gender: "male" as Gender,
    contributionStartYear: 2003,
    retirementYear: 2045,
    averageAnnualIncome: 90_000,
    // Couple
    isCouple: false,
    spouseBirthYear: 1982,
    spouseGender: "female" as Gender,
    spouseContributionStartYear: 2005,
    spouseRetirementYear: 2046,
    spouseAverageAnnualIncome: 70_000,
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

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

  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    {
      title: "Bienvenue dans le calculateur AVS/AI",
      body: "Ce mode guide vous explique chaque champ dans l'ordre de saisie. Utilisez « Suivant » ou les flèches du clavier.",
    },
    {
      target: "avs-birth-year",
      title: "Année de naissance",
      body: "Détermine l'âge de référence AVS21 (64 ou 65 ans selon le genre) et la fenêtre de retraite anticipée/ajournée.",
    },
    {
      target: "avs-gender",
      title: "Genre",
      body: "Pour les femmes nées entre 1961 et 1969, AVS21 relève progressivement l'âge de référence de 64 à 65 ans.",
    },
    {
      target: "avs-contrib-start",
      title: "Année de début de cotisation",
      body: "Année de votre première cotisation AVS (en général 18, 20 ou 21 ans selon votre situation). Sert à compter les années de cotisation.",
    },
    {
      target: "avs-retirement-year",
      title: "Année de retraite envisagée",
      body: "Année où vous cesserez de cotiser. Une retraite anticipée réduit la rente, un ajournement l'augmente.",
    },
    {
      target: "avs-income",
      title: "Revenu annuel moyen carrière",
      body: "Moyenne de vos revenus indexés sur toute la carrière. Au-delà du plafond, la rente est plafonnée à la rente max OFAS.",
    },
    {
      target: "avs-couple",
      title: "Calcul couple",
      body: "Si marié·e, la rente du couple est plafonnée à 150 % de la rente max individuelle (effet de plafonnement).",
    },
    {
      target: "avs-result",
      title: "Rente prévisionnelle",
      body: "Estimation mensuelle/annuelle. Pour un calcul officiel, demandez un Extrait de Compte Individuel (CI) à votre caisse.",
    },
  ];

  return (
    <div className="space-y-6">
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title="Guide AVS/AI" />
      {client && <ClientLinkBanner client={client} />}
      <div className="flex justify-end">
        <GuideToggleButton onClick={() => setGuideOpen(true)} />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        {/* === PARAMÈTRES === */}
        <div className="space-y-4 md:col-span-3">
          <CalcCard
            title="Personne assurée"
            description={`Âge de référence AVS21 : ${refAge} ans (déterminé par genre + année de naissance).`}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div data-guide="avs-birth-year">
                <NumField
                  label="Année de naissance"
                  value={form.birthYear}
                  onChange={(v) => set("birthYear", v)}
                />
              </div>
              <div data-guide="avs-gender" className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Genre</Label>
                <Select
                  value={form.gender}
                  onValueChange={(v) => set("gender", v as Gender)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{GENDER_LABELS.male}</SelectItem>
                    <SelectItem value="female">{GENDER_LABELS.female}</SelectItem>
                    <SelectItem value="other">{GENDER_LABELS.other}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div data-guide="avs-contrib-start">
                <NumField
                  label="Année de début de cotisation"
                  value={form.contributionStartYear}
                  onChange={(v) => set("contributionStartYear", v)}
                />
              </div>
              <div data-guide="avs-retirement-year">
                <NumField
                  label="Année de retraite envisagée"
                  value={form.retirementYear}
                  onChange={(v) => set("retirementYear", v)}
                />
              </div>
              <div data-guide="avs-income">
                <NumField
                  label="Revenu annuel moyen carrière"
                  value={form.averageAnnualIncome}
                  onChange={(v) => set("averageAnnualIncome", v)}
                  suffix="CHF"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Année courante : {currentYear} · Âge à la retraite :{" "}
              <strong>{ageAtRetirement} ans</strong>
              {ageAtRetirement < AVS_2026.referenceAgeMin ||
              ageAtRetirement > AVS_2026.referenceAgeMax ? (
                <span className="ml-1 text-warning">
                  (hors fenêtre {AVS_2026.referenceAgeMin}–{AVS_2026.referenceAgeMax})
                </span>
              ) : null}
            </p>
          </CalcCard>

          <CalcCard title="Conjoint·e (optionnel)">
            <label className="mb-3 flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isCouple}
                onCheckedChange={(v) => set("isCouple", Boolean(v))}
              />
              Calculer la rente de couple (plafonnement à {AVS_2026.maxCoupleMonthlyPension.toLocaleString("fr-CH")} CHF/mois)
            </label>
            {form.isCouple && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumField
                  label="Année de naissance"
                  value={form.spouseBirthYear}
                  onChange={(v) => set("spouseBirthYear", v)}
                />
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Genre</Label>
                  <Select
                    value={form.spouseGender}
                    onValueChange={(v) => set("spouseGender", v as Gender)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{GENDER_LABELS.male}</SelectItem>
                      <SelectItem value="female">{GENDER_LABELS.female}</SelectItem>
                      <SelectItem value="other">{GENDER_LABELS.other}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumField
                  label="Année de début de cotisation"
                  value={form.spouseContributionStartYear}
                  onChange={(v) => set("spouseContributionStartYear", v)}
                />
                <NumField
                  label="Année de retraite"
                  value={form.spouseRetirementYear}
                  onChange={(v) => set("spouseRetirementYear", v)}
                />
                <NumField
                  label="Revenu annuel moyen"
                  value={form.spouseAverageAnnualIncome}
                  onChange={(v) => set("spouseAverageAnnualIncome", v)}
                  suffix="CHF"
                />
                <p className="col-span-full text-xs text-muted-foreground">
                  Âge de référence conjoint·e : <strong>{refAgeSpouse} ans</strong>
                </p>
              </div>
            )}
          </CalcCard>
        </div>

        {/* === RÉSULTATS === */}
        <div className="space-y-4 md:col-span-2">
          <CalcCard title="Rente prévisionnelle" tilt>
            {form.isCouple && projection.combinedMonthlyPension !== undefined ? (
              <Row>
                <MoneyTile
                  label="Rente couple / mois"
                  value={projection.combinedMonthlyPension}
                  tone="primary"
                  big
                />
                <MoneyTile
                  label="Rente couple / an"
                  value={projection.combinedAnnualPension}
                  tone="success"
                />
              </Row>
            ) : (
              <Row>
                <MoneyTile
                  label="Rente / mois"
                  value={projection.primary.monthlyPension}
                  tone="primary"
                  big
                />
                <MoneyTile
                  label="Rente / an"
                  value={projection.primary.annualPension}
                  tone="success"
                />
              </Row>
            )}
            {projection.cappedCouple ? (
              <p className="mt-3 rounded-md bg-warning/10 p-2 text-xs text-warning-foreground">
                ⚠️ Plafond couple appliqué (
                {AVS_2026.maxCoupleMonthlyPension.toLocaleString("fr-CH")} CHF/mois) :
                réduction proportionnelle des deux rentes individuelles.
              </p>
            ) : null}
          </CalcCard>

          <CalcCard title="Détail personne assurée">
            <Row>
              <StatTile
                label="Années cotisées"
                value={`${projection.primary.effectiveYears} / ${AVS_2026.fullContributionYears}`}
              />
              <StatTile
                label="Années manquantes"
                value={String(projection.primary.missingYears)}
                tone={projection.primary.missingYears > 0 ? "warning" : "default"}
              />
            </Row>
            <Row>
              <MoneyTile
                label="Rente complète théorique / an"
                value={projection.primary.theoreticalAnnualPension}
              />
              <StatTile
                label="Échelle"
                value={`${(projection.primary.reductionRatio * 100).toFixed(1)} %`}
                hint="Ratio années cotisées / 44"
              />
            </Row>
          </CalcCard>

          {form.isCouple && projection.spouse && (
            <CalcCard title="Détail conjoint·e">
              <Row>
                <StatTile
                  label="Années cotisées"
                  value={`${projection.spouse.effectiveYears} / ${AVS_2026.fullContributionYears}`}
                />
                <MoneyTile
                  label="Rente individuelle / mois"
                  value={projection.spouse.monthlyPension}
                />
              </Row>
            </CalcCard>
          )}
        </div>
      </div>

      <CalcCard title="Avertissement & limites du modèle">
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li>
            • Estimation basée sur les paramètres OFAS 2026 (rente min{" "}
            {AVS_2026.minMonthlyPension.toLocaleString("fr-CH")} CHF/mois, max{" "}
            {AVS_2026.maxMonthlyPension.toLocaleString("fr-CH")} CHF/mois).
          </li>
          <li>
            • Approximation par interpolation 2 segments (marge d'erreur ±3 % vs caisse de
            compensation).
          </li>
          <li>
            • Bonifications éducatives / d'assistance et splitting AVS officiel non modélisés.
          </li>
          <li>
            • <strong>Pour un calcul officiel : demander un Extrait de Compte Individuel
              (CI)</strong>{" "}
            auprès de la caisse cantonale.
          </li>
        </ul>
      </CalcCard>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <BaseNumField
        value={String(value)}
        onChange={(v) => onChange(Number(v) || 0)}
        suffix={suffix}
      />
    </div>
  );
}
