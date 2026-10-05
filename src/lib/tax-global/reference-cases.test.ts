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
// Le résultat GE (80'000 CHF, single, 0 enfant) converge maintenant à ~1%
// du calculateur officiel (10'322.98 CHF vs 10'453 CHF ESTV) — l'écart
// résiduel vient du forfait "frais professionnels" cantonal GE (non
// résolu, voir le commentaire sur `professional` dans income.ts).

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
      totalTaxCHF: 10322.98,
      effectiveRate: 12.9,
      ifd: 907.65,
      cantonal: 6953.02,
      communal: 2437.31,
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
      totalTaxCHF: 8100.51,
      effectiveRate: 8.1,
      ifd: 1112.45,
      cantonal: 5137.25,
      communal: 1800.81,
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
      totalTaxCHF: 5400.88,
      effectiveRate: 4.5,
      ifd: 709.7,
      cantonal: 3436.54,
      communal: 1204.64,
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
      totalTaxCHF: 30407.5,
      effectiveRate: 20.3,
      ifd: 5209.15,
      cantonal: 18388.97,
      communal: 6446.06,
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
      totalTaxCHF: 12781.91,
      effectiveRate: 16,
      ifd: 907.65,
      cantonal: 5991.47,
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
      totalTaxCHF: 11425.13,
      effectiveRate: 11.4,
      ifd: 1112.45,
      cantonal: 5435.36,
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
      totalTaxCHF: 10414.3,
      effectiveRate: 8.7,
      ifd: 709.7,
      cantonal: 4830.6,
      communal: 4874,
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
      totalTaxCHF: 36738.96,
      effectiveRate: 24.5,
      ifd: 5209.15,
      cantonal: 17291.64,
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
