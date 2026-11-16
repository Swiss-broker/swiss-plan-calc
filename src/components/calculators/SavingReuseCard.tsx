// Que faire de l'économie d'impôt dégagée dans le Fiscal global : même
// tableau dans le Fiscal global et dans le calculateur 3e pilier.
import type { ReactNode } from "react";
import { CalcCard } from "@/components/calculators/CalcUI";
import { formatCHF } from "@/lib/format";
import type { SavingReuse } from "@/lib/tax-global/saving-reuse";

export function SavingReuseCard({
  reuse,
  action,
  title = "Que faire de l'économie d'impôt ?",
}: {
  reuse: SavingReuse;
  action?: ReactNode;
  title?: string;
}) {
  if (reuse.annualSaving <= 0 || reuse.placements.length === 0) return null;
  return (
    <CalcCard title={title}>
      <p className="text-sm">
        Économie d'impôt identifiée :{" "}
        <span className="font-semibold text-success">{formatCHF(reuse.annualSaving)} par an</span>
        {reuse.origin !== "none" && (
          <span className="text-muted-foreground">
            {" "}
            ({formatCHF(reuse.todayTax)} aujourd'hui, {formatCHF(reuse.afterTax)} après{" "}
            {reuse.originLabel})
          </span>
        )}
        . Placée chaque année pendant {reuse.years} an{reuse.years > 1 ? "s" : ""}, jusqu'à la
        retraite :
      </p>
      <ul className="mt-3 space-y-2">
        {reuse.placements.map((p) => (
          <li
            key={p.id}
            className={`rounded-md border p-3 text-sm ${
              p.id === reuse.bestId ? "border-success/40 bg-success/5" : "border-border"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="font-medium">
                {p.id === reuse.bestId && "★ "}
                {p.label}
              </span>
              <span className="tabular-nums font-semibold">
                {formatCHF(p.capitalAtRetirement)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  à la retraite
                </span>
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
              <span>Rendement retenu : {p.returnRate.toFixed(1)} %</span>
              {p.extraTaxSavingPerYear > 0 && (
                <span className="text-success">
                  + {formatCHF(p.extraTaxSavingPerYear)} d'impôt en moins chaque année
                </span>
              )}
              {p.exitTax > 0 && <span>Impôt de sortie déduit : {formatCHF(p.exitTax)}</span>}
              <span>Gain net : {formatCHF(p.netGain)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{p.note}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Gain net = capital à la retraite + économies d'impôt cumulées − versements. Rendements
        indicatifs, non garantis.
      </p>
      {action && <div className="mt-3">{action}</div>}
    </CalcCard>
  );
}
