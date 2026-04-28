// Formatage numérique au standard suisse.
//
// Convention : apostrophe (typographique U+2019 ou ASCII U+0027 selon usage)
// comme séparateur de milliers. Intl.NumberFormat("fr-CH") retourne par défaut
// l'apostrophe ASCII (ex: "47'200"), ce qui correspond aux conventions
// utilisées par l'AFC et les calculateurs cantonaux.

const numFmtCH = new Intl.NumberFormat("fr-CH", {
  maximumFractionDigits: 0,
});

const numFmtCH2 = new Intl.NumberFormat("fr-CH", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

/** Formate un nombre au standard suisse (apostrophe en milliers). */
export function formatNumberCH(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "—";
  return decimals === 0 ? numFmtCH.format(value) : numFmtCH2.format(value);
}

/** Formate un montant en CHF (ex: "47'200 CHF"). */
export function formatCHF(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${formatNumberCH(value, decimals)} CHF`;
}
