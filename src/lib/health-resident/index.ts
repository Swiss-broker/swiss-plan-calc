// Caisse maladie (LAMal) pour clients résidents en Suisse.
// Comparaison manuelle situation actuelle vs situation optimisée (base +
// complémentaire), avec économie mensuelle/annuelle/cumulée jusqu'à la
// retraite — même logique de comparatif que le calculateur frontalier
// (CMU vs LAMal), mais sans conversion de devise ni calcul CMU : ici les deux
// côtés sont des primes LAMal suisses saisies directement par le conseiller.

export interface HealthResidentInput {
  currentBaseMonthlyCHF: number;
  currentComplementaryMonthlyCHF: number;
  optimizedBaseMonthlyCHF: number;
  optimizedComplementaryMonthlyCHF: number;
  /** Années restantes avant la retraite, pour chiffrer l'économie cumulée */
  yearsToRetirement?: number;
  [key: string]: unknown;
}

export interface HealthResidentResult {
  currentMonthlyCHF: number;
  currentAnnualCHF: number;
  optimizedMonthlyCHF: number;
  optimizedAnnualCHF: number;
  monthlySavingsCHF: number;
  annualSavingsCHF: number;
  yearsToRetirement: number | null;
  cumulativeSavingsCHF: number | null;
  notes: string[];
}

export function computeHealthResident(input: HealthResidentInput): HealthResidentResult {
  const currentMonthlyCHF = Math.max(0, input.currentBaseMonthlyCHF) + Math.max(0, input.currentComplementaryMonthlyCHF);
  const optimizedMonthlyCHF = Math.max(0, input.optimizedBaseMonthlyCHF) + Math.max(0, input.optimizedComplementaryMonthlyCHF);
  const currentAnnualCHF = Math.round(currentMonthlyCHF * 12);
  const optimizedAnnualCHF = Math.round(optimizedMonthlyCHF * 12);

  const monthlySavingsCHF = Math.round(currentMonthlyCHF - optimizedMonthlyCHF);
  const annualSavingsCHF = currentAnnualCHF - optimizedAnnualCHF;

  const yearsToRetirement =
    input.yearsToRetirement && input.yearsToRetirement > 0 ? Math.round(input.yearsToRetirement) : null;
  const cumulativeSavingsCHF = yearsToRetirement !== null ? annualSavingsCHF * yearsToRetirement : null;

  const notes = [
    "Comparatif entre la situation actuelle (assurance de base + complémentaire) et une situation optimisée saisie manuellement par le conseiller.",
    "Les primes LAMal varient selon la caisse maladie, la franchise et la commune de domicile : vérifiez les montants sur une offre réelle avant tout changement.",
    "Un changement de caisse ou de franchise ne peut intervenir qu'aux échéances légales (en général fin d'année pour l'assurance de base, résiliable pour le 30 novembre).",
  ];

  return {
    currentMonthlyCHF: Math.round(currentMonthlyCHF),
    currentAnnualCHF,
    optimizedMonthlyCHF: Math.round(optimizedMonthlyCHF),
    optimizedAnnualCHF,
    monthlySavingsCHF,
    annualSavingsCHF,
    yearsToRetirement,
    cumulativeSavingsCHF,
    notes,
  };
}
