// Helpers de formatage CHF / pourcentages — format suisse (apostrophe en séparateur)
const numFmt = new Intl.NumberFormat("fr-CH", {
  maximumFractionDigits: 0,
});
const numFmt2 = new Intl.NumberFormat("fr-CH", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

// Normalise les séparateurs de milliers en apostrophe ASCII (U+0027).
// Intl.NumberFormat("fr-CH") émet U+202F (narrow no-break space) comme
// séparateur, qui n'est pas supporté par la police Helvetica WinAnsi de
// jsPDF (rendu erratique : espace large, "/" ou glyphe manquant).
// On force donc l'apostrophe suisse, conforme aux conventions typographiques.
const GROUP_SEP_RE = /[\u00A0\u202F\u2009\u2007 ](?=\d)/g;
function toSwissSeparator(s: string): string {
  return s.replace(GROUP_SEP_RE, "'");
}

export function formatCHF(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const fmt = decimals === 0 ? numFmt : numFmt2;
  return `CHF ${toSwissSeparator(fmt.format(value))}`;
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const formatted = decimals === 0 ? numFmt.format(value) : numFmt2.format(value);
  return toSwissSeparator(formatted);
}

export function formatPct(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(decimals).replace(".", ",")} %`;
}

export function formatDelta(value: number, currency = true): string {
  const sign = value > 0 ? "+" : "";
  return currency ? `${sign}${formatCHF(value)}` : `${sign}${formatNumber(value)}`;
}
