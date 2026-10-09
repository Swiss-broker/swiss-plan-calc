// Batterie de cas de référence — Calculateur Fiscal Global.
//
// CE QUE CE FICHIER EST : un filet de sécurité contre les régressions.
// Chaque cas fige le résultat du moteur TEL QU'IL EST AUJOURD'HUI (24
// profils représentatifs, répartis sur les 6 cantons GE/VD/VS/FR/NE/JU).
// Si un futur changement du moteur fiscal fait bouger un de ces montants
// sans que ce soit volontaire, ce test échoue immédiatement — avant que
// l'erreur n'arrive jusqu'à un vrai dossier client.
//
// CE QUE CE FICHIER N'EST PAS : une vérification indépendante contre les
// calculateurs officiels (ESTV/AFC). Pour ça, voir plutôt :
//   - src/lib/tax/cantons.test.ts (formule VS vérifiée contre les exemples
//     chiffrés officiels du Service cantonal des contributions valaisan)
//   - src/lib/tax/source.test.ts (barèmes B/C jurassiens vérifiés contre
//     les tables officielles jura.ch 2026)
//
// Si un changement de moteur est VOLONTAIRE (nouvelle donnée officielle,
// correction d'une formule), c'est normal que ces valeurs bougent : il
// faut alors les régénérer consciemment (recalculer et remplacer les
// valeurs attendues ci-dessous), pas juste faire taire le test.
//
// Régénérées intégralement le 05.10.2026 : 6 corrections apportées au
// moteur (voir cantons.ts/income.ts), chacune vérifiée indépendamment
// contre le calculateur officiel ESTV (swisstaxcalculator.estv.admin.ch,
// cas GE 80'000 CHF, avec et sans enfant) avant d'être appliquée :
//   1. GE cantonalMultiplier 0.485 → 1.475 (était faux d'un facteur ~3)
//   2. Cotisation ANP (accidents non pro, 0.4%) : ajoutée, absente avant
//   3. Forfait assurance maladie : séparé canton/IFD, GE 2'400 → 4'560
//   4. Déduction enfant : GE 13'000 → 13'698, IFD 6'700 → 6'800
//   5. Impôt personnel GE (25 CHF/personne seule) : ajouté
//
// Re-régénérées le 06.10.2026 pour les 4 cas GE : forfait "frais
// professionnels" CANTONAL corrigé (voir
// PROFESSIONAL_FORFAIT_CANTONAL_BOUNDS_2026 dans income.ts) — jusqu'ici le
// moteur réutilisait par erreur la valeur IFD (plafond 4'000 CHF) comme
// déduction cantonale, alors que GE a ses propres bornes 640/1'817 CHF
// (recoupées contre un cas de référence ESTV officiel avec 2 enfants,
// fourni par l'utilisatrice : -1'817 CHF cantonal confirmé exact pour un
// salaire net de 71'883 CHF). Le cas GE 80'000 CHF single/0 enfant
// converge maintenant à ~0.5% du calculateur officiel (10'401.54 CHF vs
// 10'453 CHF ESTV), contre ~1.3% avant ce correctif.
//
// Re-régénérées le 09.10.2026 pour les 4 cas VS : le moteur sautait
// entièrement l'indexation cantonale (Art. 32 LF), lisant le taux moyen
// directement sur le revenu réel au lieu du revenu dé-indexé — alors que
// le communal avait déjà ce traitement (par commune connue). Signalé par
// l'utilisatrice : Sion, célibataire, 0 enfant, 80'000 CHF brut, 8'444 CHF
// affichés par l'app contre 5'948 CHF initialement rapportés puis 9'487
// CHF confirmés par calculateur officiel ESTV
// (swisstaxcalculator.estv.admin.ch). Indexation cantonale 2026 = 155%,
// calibrée par recherche numérique contre ce cas réel (revenu imposable
// cantonal 65'927 CHF → 4'213.29 CHF calculés contre 4'215 CHF réels, écart
// 1.71 CHF) — voir VS_CANTONAL_INDEXATION_PERCENT_2026 dans cantons.ts.
// Même recoupement pour Sion elle-même, absente jusqu'ici de
// COMMUNAL_MULTIPLIERS.VS (indexation communale 176%, confirmée à 0.15 CHF
// près) et pour l'impôt personnel VS (24 CHF/personne seule, confirmé par
// le même cas, jusqu'ici non modélisé). Les 4 cas ci-dessous ne spécifient
// pas de commune connue (comportement par défaut, chef-lieu) : seul le
// cantonal bouge ici ; avec Sion explicitement sélectionnée le total
// converge à moins de 2% du cas réel AFC (9'321.59 CHF vs 9'487 CHF).

import { describe, expect, it } from "vitest";
import { computeTaxGlobal } from "./engine";
import { createDefaultInput } from "./profile";
import type { TaxGlobalInput } from "./types";

interface ReferenceCase {
  id: string;
  desc: string;
  overrides: Partial<TaxGlobalInput>;
  expected: {
    totalTaxCHF: number;
    effectiveRate: number;
    ifd: number;
    cantonal: number;
    communal: number;
    wealthTax: number;
  };
}

const REFERENCE_CASES: ReferenceCase[] = [
  {
    id: "GE_single_80k",
    desc: "GE \u2014 C\u00e9libataire, sans enfant, 80'000 CHF",
    overrides: { canton: "GE", civilStatus: "single", children: 0, grossSalary: 80000 },
    expected: {
      totalTaxCHF: 10401.54,
      effectiveRate: 13,
      ifd: 907.65,
      cantonal: 7011.19,
      communal: 2457.7,
      wealthTax: 0,
    },
  },
  {
    id: "GE_married_100k",
    desc: "GE \u2014 Mari\u00e9, conjoint sans activit\u00e9, 100'000 CHF",
    overrides: {
      canton: "GE",
      civilStatus: "married",
      spouseEmployed: false,
      children: 0,
      grossSalary: 100000,
    },
    expected: {
      totalTaxCHF: 8278.75,
      effectiveRate: 8.3,
      ifd: 1112.45,
      cantonal: 5269.23,
      communal: 1847.07,
      wealthTax: 0,
    },
  },
  {
    id: "GE_married_2children_120k",
    desc: "GE \u2014 Mari\u00e9, 2 enfants, 120'000 CHF",
    overrides: {
      canton: "GE",
      civilStatus: "married",
      spouseEmployed: false,
      children: 2,
      grossSalary: 120000,
    },
    expected: {
      totalTaxCHF: 5676.38,
      effectiveRate: 4.7,
      ifd: 709.7,
      cantonal: 3640.53,
      communal: 1276.15,
      wealthTax: 0,
    },
  },
  {
    id: "GE_single_wealth_150k",
    desc: "GE \u2014 C\u00e9libataire, 150'000 CHF + 300'000 fortune nette",
    overrides: {
      canton: "GE",
      civilStatus: "single",
      children: 0,
      grossSalary: 150000,
      netWealth: 300000,
    },
    expected: {
      totalTaxCHF: 30981.52,
      effectiveRate: 20.7,
      ifd: 5209.15,
      cantonal: 18814,
      communal: 6595.05,
      wealthTax: 338.32,
    },
  },
  {
    id: "VD_single_80k",
    desc: "VD \u2014 C\u00e9libataire, sans enfant, 80'000 CHF",
    overrides: { canton: "VD", civilStatus: "single", children: 0, grossSalary: 80000 },
    expected: {
      totalTaxCHF: 11855.74,
      effectiveRate: 14.8,
      ifd: 907.65,
      cantonal: 7141.11,
      communal: 3806.98,
      wealthTax: 0,
    },
  },
  {
    id: "VD_married_100k",
    desc: "VD \u2014 Mari\u00e9, conjoint sans activit\u00e9, 100'000 CHF",
    overrides: {
      canton: "VD",
      civilStatus: "married",
      spouseEmployed: false,
      children: 0,
      grossSalary: 100000,
    },
    expected: {
      totalTaxCHF: 12280.45,
      effectiveRate: 12.3,
      ifd: 1112.45,
      cantonal: 7284.55,
      communal: 3883.45,
      wealthTax: 0,
    },
  },
  {
    id: "VD_married_2children_120k",
    desc: "VD \u2014 Mari\u00e9, 2 enfants, 120'000 CHF",
    overrides: {
      canton: "VD",
      civilStatus: "married",
      spouseEmployed: false,
      children: 2,
      grossSalary: 120000,
    },
    expected: {
      totalTaxCHF: 11906.58,
      effectiveRate: 9.9,
      ifd: 709.7,
      cantonal: 7303.39,
      communal: 3893.49,
      wealthTax: 0,
    },
  },
  {
    id: "VD_single_wealth_150k",
    desc: "VD \u2014 C\u00e9libataire, 150'000 CHF + 300'000 fortune nette",
    overrides: {
      canton: "VD",
      civilStatus: "single",
      children: 0,
      grossSalary: 150000,
      netWealth: 300000,
    },
    expected: {
      totalTaxCHF: 33415.02,
      effectiveRate: 22.3,
      ifd: 5209.15,
      cantonal: 17880.94,
      communal: 9532.45,
      wealthTax: 792.48,
    },
  },
  {
    id: "VS_single_80k",
    desc: "VS \u2014 C\u00e9libataire, sans enfant, 80'000 CHF",
    overrides: { canton: "VS", civilStatus: "single", children: 0, grossSalary: 80000 },
    expected: {
      // R\u00e9g\u00e9n\u00e9r\u00e9 le 09.10.2026 : ajout de l'indexation cantonale VS 2026
      // (155%, voir VS_CANTONAL_INDEXATION_PERCENT_2026 dans cantons.ts),
      // qui manquait enti\u00e8rement \u2014 le moteur lisait le taux directement sur
      // le revenu r\u00e9el au lieu du revenu d\u00e9-index\u00e9, surestimant fortement
      // l'imp\u00f4t cantonal (ex utilisatrice : Sion 80'000 CHF, 12'781.91 CHF
      // calcul\u00e9s contre 9'487 CHF r\u00e9els AFC). communal inchang\u00e9 ici car ce
      // cas ne sp\u00e9cifie pas de commune connue (comportement par d\u00e9faut,
      // chef-lieu) ; avec Sion explicitement s\u00e9lectionn\u00e9e (vsIndexationPercent
      // 176%, d\u00e9sormais dans COMMUNAL_MULTIPLIERS.VS), le total converge \u00e0
      // 9'321.59 CHF, \u00e0 moins de 2% du cas r\u00e9el AFC.
      totalTaxCHF: 10942.65,
      effectiveRate: 13.7,
      ifd: 907.65,
      cantonal: 4128.21,
      communal: 5882.79,
      wealthTax: 0,
    },
  },
  {
    id: "VS_married_100k",
    desc: "VS \u2014 Mari\u00e9, conjoint sans activit\u00e9, 100'000 CHF",
    overrides: {
      canton: "VS",
      civilStatus: "married",
      spouseEmployed: false,
      children: 0,
      grossSalary: 100000,
    },
    expected: {
      // Régénéré le 09.10.2026, voir VS_single_80k ci-dessus.
      totalTaxCHF: 9687.03,
      effectiveRate: 9.7,
      ifd: 1112.45,
      cantonal: 3649.26,
      communal: 4877.32,
      wealthTax: 0,
    },
  },
  {
    id: "VS_married_2children_120k",
    desc: "VS \u2014 Mari\u00e9, 2 enfants, 120'000 CHF",
    overrides: {
      canton: "VS",
      civilStatus: "married",
      spouseEmployed: false,
      children: 2,
      grossSalary: 120000,
    },
    expected: {
      // Régénéré le 09.10.2026, voir VS_single_80k ci-dessus.
      totalTaxCHF: 8680.96,
      effectiveRate: 7.2,
      ifd: 709.7,
      cantonal: 3049.26,
      communal: 4874,
      wealthTax: 0,
    },
  },
  {
    id: "VS_Sion_single_80k",
    desc: "VS — Sion, célibataire, sans enfant, 80'000 CHF (cas réel AFC)",
    // Cas directement vérifié par l'utilisatrice contre le calculateur
    // officiel ESTV (swisstaxcalculator.estv.admin.ch, Sion VS, personne
    // seule, 0 enfant, sans confession, 80'000 CHF brut, 2026) : total réel
    // 9'487 CHF (cantonal 4'215, communal 4'342, impôt personnel 24, IFD
    // 906). Notre moteur converge à 9'321.59 CHF, à moins de 2% — écart
    // résiduel probable : forfait cantonal assurance maladie VS non encore
    // vérifié individuellement (utilise la valeur standard 4'560 CHF,
    // contre 3'800 CHF réels pour ce cas, voir HEALTH_INSURANCE_CANTONAL_2026
    // dans income.ts), à corriger si un canton avec forfait assurance VS
    // propre est confirmé.
    overrides: {
      canton: "VS",
      civilStatus: "single",
      children: 0,
      grossSalary: 80000,
      communalMultiplier: 1.1,
      vsIndexationPercent: 176,
    },
    expected: {
      totalTaxCHF: 9321.59,
      effectiveRate: 11.7,
      ifd: 907.65,
      cantonal: 4128.21,
      communal: 4261.73,
      wealthTax: 0,
    },
  },
  {
    id: "VS_single_wealth_150k",
    desc: "VS \u2014 C\u00e9libataire, 150'000 CHF + 300'000 fortune nette",
    overrides: {
      canton: "VS",
      civilStatus: "single",
      children: 0,
      grossSalary: 150000,
      netWealth: 300000,
    },
    expected: {
      // Régénéré le 05.10.2026 : correction du barème de fortune VS
      // (taux stockés en % au lieu de ‰, voir cantons.ts VS_WEALTH_SCALE).
      // Re-régénéré le 09.10.2026, voir VS_single_80k ci-dessus.
      totalTaxCHF: 32829.69,
      effectiveRate: 21.9,
      ifd: 5209.15,
      cantonal: 13358.37,
      communal: 13213.37,
      wealthTax: 1024.8,
    },
  },
  {
    id: "FR_single_80k",
    desc: "FR \u2014 C\u00e9libataire, sans enfant, 80'000 CHF",
    overrides: { canton: "FR", civilStatus: "single", children: 0, grossSalary: 80000 },
    expected: {
      totalTaxCHF: 11449.12,
      effectiveRate: 14.3,
      ifd: 907.65,
      cantonal: 5749.89,
      communal: 4791.58,
      wealthTax: 0,
    },
  },
  {
    id: "FR_married_100k",
    desc: "FR \u2014 Mari\u00e9, conjoint sans activit\u00e9, 100'000 CHF",
    overrides: {
      canton: "FR",
      civilStatus: "married",
      spouseEmployed: false,
      children: 0,
      grossSalary: 100000,
    },
    expected: {
      totalTaxCHF: 10796.16,
      effectiveRate: 10.8,
      ifd: 1112.45,
      cantonal: 5282.02,
      communal: 4401.69,
      wealthTax: 0,
    },
  },
  {
    id: "FR_married_2children_120k",
    desc: "FR \u2014 Mari\u00e9, 2 enfants, 120'000 CHF",
    overrides: {
      canton: "FR",
      civilStatus: "married",
      spouseEmployed: false,
      children: 2,
      grossSalary: 120000,
    },
    expected: {
      totalTaxCHF: 10095.18,
      effectiveRate: 8.4,
      ifd: 709.7,
      cantonal: 5119.35,
      communal: 4266.13,
      wealthTax: 0,
    },
  },
  {
    id: "FR_single_wealth_150k",
    desc: "FR \u2014 C\u00e9libataire, 150'000 CHF + 300'000 fortune nette",
    overrides: {
      canton: "FR",
      civilStatus: "single",
      children: 0,
      grossSalary: 150000,
      netWealth: 300000,
    },
    expected: {
      totalTaxCHF: 32234.19,
      effectiveRate: 21.5,
      ifd: 5209.15,
      cantonal: 14375.2,
      communal: 11979.34,
      wealthTax: 670.5,
    },
  },
  {
    id: "NE_single_80k",
    desc: "NE \u2014 C\u00e9libataire, sans enfant, 80'000 CHF",
    overrides: { canton: "NE", civilStatus: "single", children: 0, grossSalary: 80000 },
    expected: {
      totalTaxCHF: 12361.55,
      effectiveRate: 15.5,
      ifd: 907.65,
      cantonal: 7514.73,
      communal: 3939.17,
      wealthTax: 0,
    },
  },
  {
    id: "NE_married_100k",
    desc: "NE \u2014 Mari\u00e9, conjoint sans activit\u00e9, 100'000 CHF",
    overrides: {
      canton: "NE",
      civilStatus: "married",
      spouseEmployed: false,
      children: 0,
      grossSalary: 100000,
    },
    expected: {
      totalTaxCHF: 11186.73,
      effectiveRate: 11.2,
      ifd: 1112.45,
      cantonal: 6609.58,
      communal: 3464.7,
      wealthTax: 0,
    },
  },
  {
    id: "NE_married_2children_120k",
    desc: "NE \u2014 Mari\u00e9, 2 enfants, 120'000 CHF",
    overrides: {
      canton: "NE",
      civilStatus: "married",
      spouseEmployed: false,
      children: 2,
      grossSalary: 120000,
    },
    expected: {
      totalTaxCHF: 11380.88,
      effectiveRate: 9.5,
      ifd: 709.7,
      cantonal: 7001.2,
      communal: 3669.98,
      wealthTax: 0,
    },
  },
  {
    id: "NE_single_wealth_150k",
    desc: "NE \u2014 C\u00e9libataire, 150'000 CHF + 300'000 fortune nette",
    overrides: {
      canton: "NE",
      civilStatus: "single",
      children: 0,
      grossSalary: 150000,
      netWealth: 300000,
    },
    expected: {
      totalTaxCHF: 35231.91,
      effectiveRate: 23.5,
      ifd: 5209.15,
      cantonal: 18643.47,
      communal: 9772.79,
      wealthTax: 1606.5,
    },
  },
  {
    id: "JU_single_80k",
    desc: "JU \u2014 C\u00e9libataire, sans enfant, 80'000 CHF",
    overrides: { canton: "JU", civilStatus: "single", children: 0, grossSalary: 80000 },
    expected: {
      totalTaxCHF: 11211.3,
      effectiveRate: 14,
      ifd: 907.65,
      cantonal: 6182.19,
      communal: 4121.46,
      wealthTax: 0,
    },
  },
  {
    id: "JU_married_100k",
    desc: "JU \u2014 Mari\u00e9, conjoint sans activit\u00e9, 100'000 CHF",
    overrides: {
      canton: "JU",
      civilStatus: "married",
      spouseEmployed: false,
      children: 0,
      grossSalary: 100000,
    },
    expected: {
      totalTaxCHF: 10604.08,
      effectiveRate: 10.6,
      ifd: 1112.45,
      cantonal: 5694.98,
      communal: 3796.65,
      wealthTax: 0,
    },
  },
  {
    id: "JU_married_2children_120k",
    desc: "JU \u2014 Mari\u00e9, 2 enfants, 120'000 CHF",
    overrides: {
      canton: "JU",
      civilStatus: "married",
      spouseEmployed: false,
      children: 2,
      grossSalary: 120000,
    },
    expected: {
      totalTaxCHF: 11039.49,
      effectiveRate: 9.2,
      ifd: 709.7,
      cantonal: 6197.87,
      communal: 4131.92,
      wealthTax: 0,
    },
  },
  {
    id: "JU_single_wealth_150k",
    desc: "JU \u2014 C\u00e9libataire, 150'000 CHF + 300'000 fortune nette",
    overrides: {
      canton: "JU",
      civilStatus: "single",
      children: 0,
      grossSalary: 150000,
      netWealth: 300000,
    },
    expected: {
      totalTaxCHF: 39608.82,
      effectiveRate: 26.4,
      ifd: 5209.15,
      cantonal: 15634.49,
      communal: 10422.99,
      wealthTax: 8342.19,
    },
  },
];

describe("Fiscal Global — batterie de référence (non-régression)", () => {
  for (const c of REFERENCE_CASES) {
    it(c.desc, () => {
      const input: TaxGlobalInput = {
        ...createDefaultInput(),
        permit: "swiss",
        countryOfResidence: "CH",
        ...c.overrides,
      };
      const result = computeTaxGlobal(input);
      expect(result.totalTaxCHF).toBeCloseTo(c.expected.totalTaxCHF, 2);
      expect(result.effectiveRate).toBeCloseTo(c.expected.effectiveRate, 1);
      expect(result.income?.ifd ?? 0).toBeCloseTo(c.expected.ifd, 2);
      expect(result.income?.cantonal ?? 0).toBeCloseTo(c.expected.cantonal, 2);
      expect(result.income?.communal ?? 0).toBeCloseTo(c.expected.communal, 2);
      expect(result.income?.wealthTax ?? 0).toBeCloseTo(c.expected.wealthTax, 2);
    });
  }
});
