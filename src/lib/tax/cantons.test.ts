import { describe, expect, it } from "vitest";
import { computeCantonalCommunal, vsDeindexedReferenceIncome } from "./cantons";

// Vérifié contre les deux exemples chiffrés officiels du Service cantonal
// des contributions valaisan (page "Calcul du taux pour l'impôt communal",
// vs.ch/web/scc/baremes-canton-communes) — revenu 89'567 CHF arrondi à
// 89'500, dé-indexé par paliers de 10% (dernier palier partiel au reste).
describe("vsDeindexedReferenceIncome", () => {
  it("exemple officiel 1 : indexation 125%", () => {
    // 89'500 / 1.10 = 81'363 (125% → 115%)
    // 81'363 / 1.10 = 73'966 (115% → 105%)
    // 73'966 / 1.05 = 70'443 (105% → 100%, dernier palier de 5%)
    expect(vsDeindexedReferenceIncome(89_500, 125)).toBe(70_443);
  });

  it("exemple officiel 2 : indexation 160%", () => {
    // 6 paliers pleins de 10% : 160% → 100%
    expect(vsDeindexedReferenceIncome(89_500, 160)).toBe(50_518);
  });

  it("exemple officiel 3 : indexation 163%", () => {
    // 6 paliers pleins de 10% (163% → 103%) puis un palier partiel de 3%
    expect(vsDeindexedReferenceIncome(89_500, 163)).toBe(49_046);
  });

  it("aucune indexation (100%) : revenu inchangé", () => {
    expect(vsDeindexedReferenceIncome(89_500, 100)).toBe(89_500);
  });
});

describe("computeCantonalCommunal VS — indexation communale", () => {
  it("sans vsIndexationPercent : comportement historique inchangé (taux lu sur le revenu réel non arrondi)", () => {
    const withIndexation = computeCantonalCommunal({
      canton: "VS",
      taxableIncome: 100_000,
      status: "single",
      communalMultiplier: 1.2,
    });
    const explicitNoIndexation = computeCantonalCommunal({
      canton: "VS",
      taxableIncome: 100_000,
      status: "single",
      communalMultiplier: 1.2,
      vsIndexationPercent: undefined,
    });
    expect(withIndexation.communal).toBe(explicitNoIndexation.communal);
  });

  it("avec vsIndexationPercent : résultat différent de l'ancien comportement (dé-indexation effective)", () => {
    const withoutIndexation = computeCantonalCommunal({
      canton: "VS",
      taxableIncome: 100_000,
      status: "single",
      communalMultiplier: 1.2,
    });
    const withIndexation = computeCantonalCommunal({
      canton: "VS",
      taxableIncome: 100_000,
      status: "single",
      communalMultiplier: 1.2,
      vsIndexationPercent: 165,
    });
    expect(withIndexation.communal).not.toBe(withoutIndexation.communal);
    // Indexation plus élevée que 100% → revenu déterminant le taux plus bas
    // → taux moyen plus bas → impôt communal plus bas (règle "plus
    // l'indexation est élevée, moins l'impôt est élevé").
    expect(withIndexation.communal).toBeLessThan(withoutIndexation.communal);
  });
});
