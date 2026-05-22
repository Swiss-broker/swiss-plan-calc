// PDF, Courrier de réclamation fiscale liée au taux de change.
import { ReportPdf, makeFilename, type PdfHeaderInfo } from "./builder";
import { formatCHF, formatPct } from "@/lib/format";
import type { FxClaimInput, FxClaimResult } from "@/lib/fx/analyze";

export function exportFxClaimPdf(args: {
  header?: Partial<PdfHeaderInfo>;
  input: FxClaimInput;
  result: FxClaimResult;
  client?: { firstName: string; lastName: string; address?: string };
  authorityName?: string;
}) {
  const { input, result, client, authorityName } = args;
  const pdf = new ReportPdf({
    title: "Réclamation, Conversion des revenus en devise étrangère",
    subtitle: `Année fiscale ${input.taxYear} · ${input.currency}/CHF`,
    ...args.header,
  } as PdfHeaderInfo);

  pdf.situationBanner(`RÉCLAMATION TAUX DE CHANGE · ${input.taxYear}`);
  pdf.section("Synthèse");
  pdf.paragraph(
    `Le contribuable conteste l'application du taux de change moyen annuel AFC ` +
      `(${input.afcRate.toFixed(4)} CHF / ${input.currency}) pour la conversion de ses revenus en ` +
      `${input.currency}. Les versements ayant été perçus à des dates précises où le cours de référence ` +
      `BNS/ECB était sensiblement différent, l'application uniforme du taux annuel conduit à une ` +
      `surévaluation du revenu imposable.`,
  );

  pdf.metricsGrid([
    { label: "Revenu total (devise)", value: `${formatNumber(result.totalForeign)} ${input.currency}` },
    { label: "CHF retenu (AFC)", value: result.totalChfAfc, tone: "warning" },
    { label: "CHF réel (BNS/ECB)", value: result.totalChfMarket, tone: "primary" },
    { label: "Écart en faveur du contribuable", value: result.totalDeltaChf, tone: "success" },
    { label: "Économie d'impôt estimée", value: result.estimatedTaxRefund, tone: "success" },
    { label: "Écart relatif", value: formatPct(result.deltaRelativePct) },
  ]);

  pdf.section("Détail des versements");
  pdf.table(
    ["Date", "Libellé", `Montant ${input.currency}`, "Taux BNS/ECB", "CHF (AFC)", "CHF (marché)", "Écart CHF"],
    result.lines.map((l) => [
      l.date,
      l.label || "—",
      formatNumber(l.amount),
      l.marketRate.toFixed(4),
      formatCHF(l.chfAfc),
      formatCHF(l.chfMarket),
      formatCHF(l.deltaChf),
    ]),
  );

  pdf.section("Demande");
  pdf.paragraph(
    `Conformément à la jurisprudence du Tribunal fédéral admettant l'usage du taux de change réel ` +
      `à la date du versement lorsque le contribuable peut le démontrer (cf. art. 16 al. 1 LIFD et ` +
      `pratique cantonale), nous demandons à ${authorityName || "l'administration fiscale"} de rectifier ` +
      `le revenu imposable retenu pour l'année ${input.taxYear} en appliquant les taux journaliers ` +
      `de référence ECB/BNS aux versements détaillés ci-dessus.`,
  );
  pdf.paragraph(
    `L'économie d'impôt résultante est estimée à ${formatCHF(result.estimatedTaxRefund)} ` +
      `(sur la base d'un taux marginal de ${formatPct(input.marginalRate)}).`,
  );

  if (client) {
    pdf.section("Contribuable");
    pdf.kvTable([
      ["Nom", `${client.firstName} ${client.lastName}`],
      ...(client.address ? [["Adresse", client.address] as [string, string]] : []),
      ["Année fiscale concernée", String(input.taxYear)],
    ]);
  }

  pdf.section("Pièces jointes recommandées");
  pdf.paragraph(
    "· Fiches de salaire ou justificatifs de versement détaillant les dates exactes\n" +
      "· Relevés bancaires confirmant les dates de crédit\n" +
      "· Extraits officiels BNS (data.snb.ch) ou ECB pour les taux de référence aux dates citées",
  );

  pdf.save(
    makeFilename(
      "Reclamation_FX",
      `${input.currency}_${input.taxYear}${client ? `_${client.lastName}` : ""}`,
    ),
  );
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 2 }).format(n);
}
