// Taux de change officiels AFC (cours fiscaux annuels CH) et taux marché ECB/BNS.
//
// Sources :
//  - AFC (Administration fédérale des contributions) : taux moyens annuels
//    publiés à l'attention des contribuables pour conversion des revenus/
//    fortune étrangers. https://www.estv.admin.ch (Notices A1/A1a, taux annuels).
//  - BNS (Banque nationale suisse) : taux de change journaliers de référence.
//    Portail data.snb.ch — interrogeable côté serveur.
//  - ECB (Banque centrale européenne) : taux de référence EUR. Proxy gratuit
//    sans clé : https://api.frankfurter.app/ (basé ECB).
//
// Ces taux servent de base de comparaison pour les réclamations fiscales :
//   « Taux AFC retenu » vs « Taux réel à la date de transaction (BNS/ECB) ».

export type Currency = "EUR" | "USD" | "GBP" | "CAD" | "JPY";

/**
 * Taux moyens annuels AFC — 1 unité de devise = X CHF.
 * Valeurs publiées (notices AFC). À mettre à jour chaque année fiscale.
 * Note JPY : taux pour 100 JPY (convention AFC).
 */
export const AFC_ANNUAL_RATES: Record<number, Partial<Record<Currency, number>>> = {
  2017: { EUR: 1.1117, USD: 0.9848, GBP: 1.2691, CAD: 0.7588, JPY: 0.8783 },
  2018: { EUR: 1.1547, USD: 0.9779, GBP: 1.3046, CAD: 0.7547, JPY: 0.8853 },
  2019: { EUR: 1.1124, USD: 0.9937, GBP: 1.2691, CAD: 0.7490, JPY: 0.9119 },
  2020: { EUR: 1.0705, USD: 0.9395, GBP: 1.2050, CAD: 0.7011, JPY: 0.8809 },
  2021: { EUR: 1.0811, USD: 0.9145, GBP: 1.2576, CAD: 0.7298, JPY: 0.8328 },
  2022: { EUR: 1.0047, USD: 0.9558, GBP: 1.1812, CAD: 0.7345, JPY: 0.7290 },
  2023: { EUR: 0.9716, USD: 0.8984, GBP: 1.1175, CAD: 0.6661, JPY: 0.6411 },
  2024: { EUR: 0.9518, USD: 0.8800, GBP: 1.1230, CAD: 0.6432, JPY: 0.5817 },
  2025: { EUR: 0.9376, USD: 0.8500, GBP: 1.1100, CAD: 0.6200, JPY: 0.5650 },
};

export function getAfcRate(year: number, currency: Currency): number | null {
  return AFC_ANNUAL_RATES[year]?.[currency] ?? null;
}

export const SUPPORTED_CURRENCIES: Currency[] = ["EUR", "USD", "GBP", "CAD", "JPY"];

/** Années couvertes par les taux AFC officiels. */
export const AFC_COVERED_YEARS = Object.keys(AFC_ANNUAL_RATES)
  .map(Number)
  .sort((a, b) => b - a);
