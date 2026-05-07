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
import { WikiTip } from "@/components/calculators/WikiTip";

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
    departureYear: 0, // 0 = pas de départ prévu
    educationalYears: 0,
    educationalShare: 100,
    assistanceYears: 0,
    assistanceShare: 100,
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
                  wikiId="avs-base"
                  wikiTip="Détermine l'âge AVS de référence (AVS21 : 64/65 ans selon genre)."
                />
              </div>
              <div data-guide="avs-gender" className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span>Genre</span>
                  <WikiTip articleId="avs-base" tip="AVS21 : femmes nées 1961-1969 voient leur âge de référence relevé progressivement de 64 à 65 ans." />
                </Label>
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
                  wikiId="avs-base"
                  wikiTip="Année de la 1re cotisation AVS. Échelle 44 = rente complète. Chaque année manquante = environ 1/44 perdu."
                />
              </div>
              <div data-guide="avs-retirement-year">
                <NumField
                  label="Année de retraite envisagée"
                  value={form.retirementYear}
                  onChange={(v) => set("retirementYear", v)}
                  wikiId="avs-anticipation"
                  wikiTip="Anticipation : -6.8 % par année. Ajournement : +5.2 % à +31.5 % selon durée."
                />
              </div>
              <div data-guide="avs-income">
                <NumField
                  label="Revenu annuel moyen carrière"
                  value={form.averageAnnualIncome}
                  onChange={(v) => set("averageAnnualIncome", v)}
                  suffix="CHF"
                  wikiId="avs-base"
                  wikiTip="Moyenne indexée des revenus AVS. Au-delà du plafond, la rente est plafonnée à la rente max OFAS."
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

          <CalcCard title="Bonifications & cas particuliers (optionnel)">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumField
                label="Année de départ prévu de Suisse"
                value={form.departureYear}
                onChange={(v) => set("departureYear", v)}
                wikiId="avs-base"
                wikiTip="Si renseigné (≠ 0), les cotisations s'arrêtent à cette date au lieu de l'année de retraite. Critique pour frontaliers/expatriés."
              />
              <div />
              <NumField
                label="Années avec enfant < 16 ans (bonif. éducatives)"
                value={form.educationalYears}
                onChange={(v) => set("educationalYears", v)}
                wikiId="avs-base"
                wikiTip="3 × rente min annuelle (45 360 CHF en 2026) ajoutés au revenu déterminant par année reconnue."
              />
              <NumField
                label="Part attribuée éducatives (%)"
                value={form.educationalShare}
                onChange={(v) => set("educationalShare", v)}
                suffix="%"
                wikiId="avs-base"
                wikiTip="50 % si conjoint actif (à répartir), 100 % si seul parent / conjoint inactif."
              />
              <NumField
                label="Années tâches d'assistance"
                value={form.assistanceYears}
                onChange={(v) => set("assistanceYears", v)}
                wikiId="avs-base"
                wikiTip="Années passées à s'occuper d'un proche nécessitant des soins (handicap moyen/grave, conditions strictes)."
              />
              <NumField
                label="Part attribuée assistance (%)"
                value={form.assistanceShare}
                onChange={(v) => set("assistanceShare", v)}
                suffix="%"
              />
            </div>
            {(form.educationalYears > 0 || form.assistanceYears > 0 || form.departureYear > 0) && (
              <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs space-y-1">
                {form.departureYear > 0 && (
                  <p>
                    Départ prévu en <strong>{form.departureYear}</strong> :{" "}
                    {projection.primary.effectiveYears} années cotisées effectivement,{" "}
                    {projection.primary.missingYears} années manquantes.
                  </p>
                )}
                {projection.primary.bonificationsBonus > 0 && (
                  <p>
                    Bonus revenu déterminant : <strong>+{projection.primary.bonificationsBonus.toLocaleString("fr-CH")} CHF/an</strong>{" "}
                    (revenu déterminant final : {projection.primary.determiningIncome.toLocaleString("fr-CH")} CHF).
                  </p>
                )}
              </div>
            )}
          </CalcCard>

          <div data-guide="avs-couple"><CalcCard title="Conjoint·e (optionnel)">
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
          </CalcCard></div>
        </div>

        {/* === RÉSULTATS === */}
        <div className="space-y-4 md:col-span-2">
          <div data-guide="avs-result"><CalcCard title="Rente prévisionnelle" tilt>
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
          </CalcCard></div>

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

      <CalcCard title="Méthodologie & points de vigilance">
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li>
            • Calcul basé sur les paramètres OFAS 2026 (rente min{" "}
            {AVS_2026.minMonthlyPension.toLocaleString("fr-CH")} CHF/mois, max{" "}
            {AVS_2026.maxMonthlyPension.toLocaleString("fr-CH")} CHF/mois, échelle 44).
          </li>
          <li>
            • Modèle d'interpolation 2 segments calibré sur la formule de rente OFAS
            (écart observé ±3 % vs caisse de compensation pour situations standard).
          </li>
          <li>
            • Bonifications éducatives / assistance modélisées (P3) ; splitting AVS
            officiel pour couple : approximation par plafonnement proportionnel.
          </li>
          <li>
            • La rente définitive est arrêtée par la Caisse de compensation au départ
            à la retraite, sur la base de l'Extrait de Compte Individuel (CI) officiel.
          </li>
        </ul>
        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
          <p className="font-medium text-foreground">💡 Extrait de Compte Individuel (CI) AVS</p>
          <p className="mt-1 text-muted-foreground">
            Demande gratuite auprès de la caisse de compensation cantonale du client.
            Liste les années réellement cotisées et les revenus AVS retenus.
          </p>
          <a
            href="https://www.ahv-iv.ch/fr/Particuliers/Extrait-CI/Demander-l-extrait-de-compte-CI"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-primary underline hover:no-underline"
          >
            → Faire la demande en ligne (ahv-iv.ch)
          </a>
          <p className="mt-2 text-muted-foreground">
            Documents à fournir : numéro AVS (756.XXXX.XXXX.XX) + pièce d'identité.
          </p>
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
