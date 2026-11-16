// Banc d'essai : tous les profils de clients (régime fiscal, canton, état
// civil, enfants, paliers de salaire, 3e pilier A) passent dans tous les
// moteurs. Vérifie qu'aucun chiffre n'est aberrant et que les calculateurs
// d'un même dossier donnent les mêmes montants.
import { expect, it } from "vitest";
import { computeSavingReuse, computeSavingReuseFromBundle } from "@/lib/tax-global/saving-reuse";
import { computeTaxGlobal } from "@/lib/tax-global/engine";
import { createDefaultInput } from "@/lib/tax-global/profile";
import type { TaxGlobalInput } from "@/lib/tax-global/types";
import { computeRegimeAwareDeduction } from "@/lib/tax/regime-aware-deduction";
import { computeClientDashboard } from "@/lib/client-dashboard";
import { toTaxGlobalInput, toRetirementInput, stripUndefined, type ClientBundle } from "@/lib/clients/to-calculator-input";
import { CANTON_SCALES } from "@/lib/tax/income";

const KIDS = [
  { date_of_birth: "2018-04-02", in_household: true },
  { date_of_birth: "2021-11-20", in_household: true },
  { date_of_birth: "2014-01-20", in_household: true },
];
function bundle(client: Record<string, unknown>, p3a: number): ClientBundle {
  return {
    client: { commune: null, country_of_residence: "CH", permit: "swiss", tax_status: "resident", civil_status: "single", children: [], confession: "none", date_of_birth: "1985-03-10", work_status: "employee", bonus: 0, spouse_gross_annual_salary: null, other_income: 0, family_allowances: null, mortgage_interest_france: null, ...client } as any,
    pension: { pillar_3a_annual_contribution: p3a, lpp_current_balance: 120_000, lpp_max_buyback: 60_000 } as any,
    assets: null,
  };
}
const gi = (b: ClientBundle): TaxGlobalInput => ({ ...createDefaultInput(), ...stripUndefined(toTaxGlobalInput(b) as any) }) as TaxGlobalInput;

it("tous les profils : chiffres plausibles et identiques d'un calculateur à l'autre", { timeout: 300000 }, () => {
  const cantons = Object.keys(CANTON_SCALES);
  const anomalies: Record<string, string[]> = {};
  const add = (k: string, d: string) => { (anomalies[k] ??= []).push(d); };
  const regimes: Array<[string, Record<string, unknown>, string[]]> = [
    ["resident", {}, cantons],
    ["source", { permit: "B", tax_status: "source_taxed" }, cantons],
    ["frontGE", { permit: "G", country_of_residence: "FR", tax_status: "cross_border_ge" }, ["GE"]],
    ["frontFR", { permit: "G", country_of_residence: "FR", tax_status: "cross_border_other" }, ["FR"]],
    ["front1983", { permit: "G", country_of_residence: "FR", tax_status: "cross_border_fr_1983" }, ["VD", "VS", "NE", "JU"]],
  ];
  const civils: Array<[string, Record<string, unknown>]> = [
    ["single", { civil_status: "single" }],
    ["cohab", { civil_status: "cohabiting" }],
    ["divorced", { civil_status: "divorced" }],
    ["married1", { civil_status: "married" }],
    ["married2", { civil_status: "married", spouse_gross_annual_salary: 50_000 }],
  ];
  const salaries = [30_000, 45_000, 60_000, 78_000, 95_000, 119_000, 120_000, 121_000, 150_000, 200_000, 300_000, 500_000];
  let n = 0;
  for (const [rn, rc, cs] of regimes) for (const canton of cs) for (const [cn, cc] of civils) for (const k of [0, 1, 2, 3]) {
    let prevTax = -1, prevOpt = -1;
    for (const sal of salaries) for (const p3a of [0, 7_258]) {
      n++;
      const id = `${rn}/${canton}/${cn}/k${k}/${sal}/3a${p3a}`;
      let b: ClientBundle, g: TaxGlobalInput;
      try {
        b = bundle({ canton, ...rc, ...cc, children: KIDS.slice(0, k), gross_annual_salary: sal }, p3a);
        g = gi(b);
        const r = computeTaxGlobal(g);
        const opt = computeTaxGlobal({ ...g, assumeTou: true });
        const d = computeClientDashboard(b);
        const bad = (x: number) => !Number.isFinite(x) || x < 0;
        if (bad(r.totalTaxCHF) || bad(opt.totalTaxCHF) || bad(r.marginalRate) || bad(opt.marginalRate)) add("NaN/negatif", id);
        if (r.marginalRate > 55 || opt.marginalRate > 55) add("marginal>55", `${id} ${r.marginalRate}/${opt.marginalRate}`);
        if (r.grossIncomeCHF > 0 && r.totalTaxCHF / r.grossIncomeCHF > 0.5) add("effectif>50%", `${id} ${r.totalTaxCHF}`);
        if (d.tax?.annualBurden !== Math.round(r.totalTaxCHF)) add("dashboard≠fiscal", `${id} ${d.tax?.annualBurden} vs ${r.totalTaxCHF}`);
        if (toRetirementInput(b).rentMarginalRate !== Math.round(r.marginalRate * 10) / 10) add("retraite marginal≠", `${id}`);
        if (d.cantonCompare && d.cantonCompare.current.total !== Math.round(r.totalTaxCHF)) add("cantonCompare≠", `${id} ${d.cantonCompare.current.total} vs ${r.totalTaxCHF}`);
        if (p3a === 0) {
          if (prevTax >= 0 && r.totalTaxCHF < prevTax - 1) add("impôt actuel décroît avec salaire", `${id} ${prevTax}→${r.totalTaxCHF}`);
          if (prevOpt >= 0 && opt.totalTaxCHF < prevOpt - 1) add("impôt TOU décroît avec salaire", `${id} ${prevOpt}→${opt.totalTaxCHF}`);
          prevTax = r.totalTaxCHF; prevOpt = opt.totalTaxCHF;
          if (r.marginalRate === 0 && sal >= 95_000 && rn !== "front1983") add("marginal 0 à haut salaire", `${id}`);
          if (opt.marginalRate < 5 && sal >= 150_000 && rn !== "front1983") add("marginal TOU <5 à 150k+", `${id} ${opt.marginalRate}`);
        }
        for (const [field, amount] of [["pillar3aContributions", 7_258], ["lppBuyback", 20_000]] as const) {
          const via = Math.round(computeTaxGlobal({ ...g, assumeTou: true, [field]: 0 }).totalTaxCHF - computeTaxGlobal({ ...g, assumeTou: true, [field]: amount }).totalTaxCHF);
          const ra = computeRegimeAwareDeduction({ bundle: b, fallbackTaxInput: { canton, status: "single", grossSalary: sal }, deductionAmount: amount, deductionField: field });
          if (ra.taxSavings !== via) add(`${field} écran≠fiscal`, `${id} ${ra.taxSavings} vs ${via}`);
          if (via < 0) add(`${field} économie négative`, `${id} ${via}`);
          if (via > amount * 0.5) add(`${field} économie>50%`, `${id} ${via}`);
          if (via === 0 && sal >= 95_000 && rn !== "front1983") add(`${field} économie 0 à haut salaire`, `${id}`);
          if (rn === "front1983" && via !== 0) add(`${field} économie≠0 accord 1983`, `${id} ${via}`);
          // l'économie doit être cohérente avec le taux marginal TOU (±40 % relatif)
          const m = computeTaxGlobal({ ...g, assumeTou: true, [field]: 0 }).marginalRate;
          if (via > 0 && m > 0 && field === "pillar3aContributions") {
            const implied = (via / amount) * 100;
            if (implied > m * 1.35 + 2 || implied < m * 0.6 - 2) add("3a économie vs taux marginal incohérents", `${id} implicite ${implied.toFixed(1)} vs marginal ${m}`);
          }
        }
        if (field3aDash(d) !== undefined && p3a > 0) {
          const via = Math.round(computeTaxGlobal({ ...g, assumeTou: true, pillar3aContributions: 0 }).totalTaxCHF - computeTaxGlobal({ ...g, assumeTou: true, pillar3aContributions: p3a }).totalTaxCHF);
          if (field3aDash(d) !== Math.max(0, via)) add("dashboard 3a≠fiscal", `${id} ${field3aDash(d)} vs ${via}`);
        }
        // enfants : en TOU/ordinaire, plus d'enfants ne doit pas augmenter l'impôt
        if (k > 0 && p3a === 0) {
          const g0 = gi(bundle({ canton, ...rc, ...cc, children: KIDS.slice(0, k - 1), gross_annual_salary: sal }, p3a));
          const o0 = computeTaxGlobal({ ...g0, assumeTou: true }).totalTaxCHF;
          if (opt.totalTaxCHF > o0 + 1) add("enfant supplémentaire augmente l'impôt TOU", `${id} ${o0}→${opt.totalTaxCHF}`);
        }
        // rachat LPP : un rachat plus élevé ne peut pas rapporter moins
        if (p3a === 0) {
          const sv = (a: number) => computeRegimeAwareDeduction({ bundle: b, fallbackTaxInput: { canton, status: "single", grossSalary: sal }, deductionAmount: a, deductionField: "lppBuyback" }).taxSavings;
          const s5 = sv(5_000), s20 = sv(20_000), s50 = sv(50_000);
          if (s20 < s5 || s50 < s20) add("rachat LPP non croissant", `${id} ${s5}/${s20}/${s50}`);
          // 3e pilier B : jamais d'impôt en plus
          const b0 = computeTaxGlobal({ ...g, assumeTou: true, pillar3bContributions: 0 }).totalTaxCHF;
          const b1 = computeTaxGlobal({ ...g, assumeTou: true, pillar3bContributions: 3_000 }).totalTaxCHF;
          if (b1 > b0 + 1) add("3b augmente l'impôt", `${id} ${b0}→${b1}`);
          // fortune : jamais d'impôt en moins
          const w1 = computeTaxGlobal({ ...g, assumeTou: true, netWealth: 500_000 }).totalTaxCHF;
          if (w1 < opt.totalTaxCHF - 1) add("fortune réduit l'impôt", `${id} ${opt.totalTaxCHF}→${w1}`);
        }
        // report de l'économie d'impôt : dossier client = Fiscal global
        const reuse = computeSavingReuse(g);
        const reuseB = computeSavingReuseFromBundle(b);
        if (reuse.annualSaving !== reuseB.annualSaving) add("économie à placer dossier≠fiscal", `${id}`);
        if (reuse.todayTax !== Math.round(r.totalTaxCHF)) add("économie à placer : impôt du jour≠fiscal", `${id}`);
        if (reuse.afterTax > reuse.todayTax) add("démarche plus chère que la situation actuelle", `${id}`);
        for (const pl of reuse.placements) {
          if (!Number.isFinite(pl.capitalAtRetirement) || pl.capitalAtRetirement < 0) add("placement aberrant", `${id} ${pl.id}`);
          if (pl.extraTaxSavingPerYear > pl.yearlyAmount * 0.5) add("placement : économie>50%", `${id} ${pl.id}`);
        }
        // source : rectification
        if (r.sourceRectification) {
          const sr = r.sourceRectification;
          if (sr.applicable && sr.rectifiedAnnualTax > sr.defaultAnnualTax) add("rectification auto plus chère", `${id} ${sr.defaultScaleCode}→${sr.rectifiedScaleCode} ${sr.defaultAnnualTax}→${sr.rectifiedAnnualTax}`);
        }
      } catch (e: any) {
        add("EXCEPTION", `${id} ${String(e.message).slice(0, 120)}`);
      }
    }
  }
  function field3aDash(d: any) { return d.pillar3a?.taxSavings; }
  // Constats attendus, pas des anomalies : impôt déjà nul (rien à
  // économiser), et baisse d'impôt à 120'000 CHF pour un imposé à la source
  // avec enfants (la taxation ordinaire devient obligatoire et prend enfin
  // les enfants en compte).
  const EXPECTED = [
    "3a économie vs taux marginal incohérents",
    "pillar3aContributions économie 0 à haut salaire",
    "lppBuyback économie 0 à haut salaire",
    "impôt actuel décroît avec salaire",
    "marginal 0 à haut salaire",
  ];
  const report = Object.entries(anomalies)
    .filter(([k]) => !EXPECTED.includes(k))
    .map(([k, v]) => `${k} : ${v.length} cas, ex. ${v.slice(0, 5).join(" | ")}`);
  if (process.env.MATRIX_OUT) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("node:fs").writeFileSync(
      process.env.MATRIX_OUT,
      [`${n} cas`, ...Object.entries(anomalies).map(([k, v]) => `\n## ${k} : ${v.length}\n` + v.slice(0, 40).join("\n"))].join("\n"),
    );
  }
  expect(n).toBeGreaterThan(10_000);
  expect(report).toEqual([]);
});
