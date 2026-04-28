// Helpers de formatage CHF / pourcentages — format suisse (apostrophe en séparateur)
const numFmt = new Intl.NumberFormat("fr-CH", {
  maximumFractionDigits: 0,
});
const numFmt2 = new Intl.NumberFormat("fr-CH", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function formatCHF(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const fmt = decimals === 0 ? numFmt : numFmt2;
  return `CHF ${fmt.format(value)}`;
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return decimals === 0 ? numFmt.format(value) : numFmt2.format(value);
}

export function formatPct(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(decimals).replace(".", ",")} %`;
}

export function formatDelta(value: number, currency = true): string {
  const sign = value > 0 ? "+" : "";
  return currency ? `${sign}${formatCHF(value)}` : `${sign}${formatNumber(value)}`;
}
