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
      totalTaxCHF: 5910.15,
      effectiveRate: 7.4,
      ifd: 899.05,
      cantonal: 2425.42,
      communal: 2585.68,
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
      totalTaxCHF: 5074.57,
      effectiveRate: 5.1,
      ifd: 1080,
      cantonal: 1933.41,
      communal: 2061.16,
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
      totalTaxCHF: 3586.97,
      effectiveRate: 3,
      ifd: 648.35,
      cantonal: 1422.32,
      communal: 1516.3,
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
      totalTaxCHF: 18403.61,
      effectiveRate: 12.3,
      ifd: 5208.55,
      cantonal: 6222.79,
      communal: 6633.95,
      wealthTax: 338.32,
    },
  },
  {
    id: "VD_single_80k",
    desc: "VD \u2014 C\u00e9libataire, sans enfant, 80'000 CHF",
    overrides: { canton: "VD", civilStatus: "single", children: 0, grossSalary: 80000 },
    expected: {
      totalTaxCHF: 12455.93,
      effectiveRate: 15.6,
      ifd: 905,
      cantonal: 7534.33,
      communal: 4016.6,
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
      totalTaxCHF: 13301.82,
      effectiveRate: 13.3,
      ifd: 1096,
      cantonal: 7961.49,
      communal: 4244.33,
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
      totalTaxCHF: 12753.62,
      effectiveRate: 10.6,
      ifd: 656.35,
      cantonal: 7890.69,
      communal: 4206.58,
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
      totalTaxCHF: 34265.31,
      effectiveRate: 22.8,
      ifd: 5226.15,
      cantonal: 18424.47,
      communal: 9822.21,
      wealthTax: 792.48,
    },
  },
  {
    id: "VS_single_80k",
    desc: "VS \u2014 C\u00e9libataire, sans enfant, 80'000 CHF",
    overrides: { canton: "VS", civilStatus: "single", children: 0, grossSalary: 80000 },
    expected: {
      totalTaxCHF: 13559.36,
      effectiveRate: 16.9,
      ifd: 905,
      cantonal: 6450.79,
      communal: 6203.57,
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
      totalTaxCHF: 12448.23,
      effectiveRate: 12.4,
      ifd: 1096,
      cantonal: 6073.54,
      communal: 5278.69,
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
      totalTaxCHF: 11473.18,
      effectiveRate: 9.6,
      ifd: 672.35,
      cantonal: 5504.18,
      communal: 5296.65,
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
      totalTaxCHF: 37517.4,
      effectiveRate: 25,
      ifd: 5226.15,
      cantonal: 17705.81,
      communal: 13560.64,
      wealthTax: 1024.8,
    },
  },
  {
    id: "FR_single_80k",
    desc: "FR \u2014 C\u00e9libataire, sans enfant, 80'000 CHF",
    overrides: { canton: "FR", civilStatus: "single", children: 0, grossSalary: 80000 },
    expected: {
      totalTaxCHF: 12135.1,
      effectiveRate: 15.2,
      ifd: 910.9,
      cantonal: 6122.29,
      communal: 5101.91,
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
      totalTaxCHF: 11913.52,
      effectiveRate: 11.9,
      ifd: 1112,
      cantonal: 5891.74,
      communal: 4909.78,
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
      totalTaxCHF: 11282.09,
      effectiveRate: 9.4,
      ifd: 696.35,
      cantonal: 5774.04,
      communal: 4811.7,
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
      totalTaxCHF: 33145.17,
      effectiveRate: 22.1,
      ifd: 5243.75,
      cantonal: 14853.23,
      communal: 12377.69,
      wealthTax: 670.5,
    },
  },
  {
    id: "NE_single_80k",
    desc: "NE \u2014 C\u00e9libataire, sans enfant, 80'000 CHF",
    overrides: { canton: "NE", civilStatus: "single", children: 0, grossSalary: 80000 },
    expected: {
      totalTaxCHF: 12995.56,
      effectiveRate: 16.2,
      ifd: 902,
      cantonal: 7934.4,
      communal: 4159.16,
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
      totalTaxCHF: 12258.95,
      effectiveRate: 12.3,
      ifd: 1088,
      cantonal: 7329.09,
      communal: 3841.86,
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
      totalTaxCHF: 12462.13,
      effectiveRate: 10.4,
      ifd: 656.35,
      cantonal: 7745.59,
      communal: 4060.19,
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
      totalTaxCHF: 36062.2,
      effectiveRate: 24,
      ifd: 5217.35,
      cantonal: 19182.83,
      communal: 10055.52,
      wealthTax: 1606.5,
    },
  },
  {
    id: "JU_single_80k",
    desc: "JU \u2014 C\u00e9libataire, sans enfant, 80'000 CHF",
    overrides: { canton: "JU", civilStatus: "single", children: 0, grossSalary: 80000 },
    expected: {
      totalTaxCHF: 11857.6,
      effectiveRate: 14.8,
      ifd: 907.95,
      cantonal: 6569.79,
      communal: 4379.86,
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
      totalTaxCHF: 11634.91,
      effectiveRate: 11.6,
      ifd: 1104,
      cantonal: 6318.55,
      communal: 4212.36,
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
      totalTaxCHF: 12103.77,
      effectiveRate: 10.1,
      ifd: 680.35,
      cantonal: 6854.05,
      communal: 4569.37,
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
      totalTaxCHF: 40440.63,
      effectiveRate: 27,
      ifd: 5234.95,
      cantonal: 16118.09,
      communal: 10745.4,
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
