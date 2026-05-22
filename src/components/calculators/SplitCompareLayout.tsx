// Écran scindé "Situation actuelle vs Situation projetée"
// Composant central réutilisable pour tous les comparateurs (3a, LPP, retraite,
// canton-compare, AVS/AI). Affiche deux colonnes côte à côte (empilées en
// mobile) avec un bandeau de synthèse en bas : économie annuelle, gain
// retraite, % d'amélioration.
import type { ReactNode } from "react";
import { ArrowRight, TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCHF, formatPct } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export type SplitRowFormat = "chf" | "pct" | "text" | "chf_per_month";

export interface SplitRow {
  label: string;
  current: number | string | null | undefined;
  projected: number | string | null | undefined;
  format?: SplitRowFormat;
  /** "higher_is_better" (défaut) ou "lower_is_better" — pilote la couleur du delta. */
  betterWhen?: "higher" | "lower" | "neutral";
  hint?: string;
}

export interface SplitSummary {
  /** Économie annuelle en CHF (positive = bon). */
  annualSaving?: number;
  /** Gain retraite (capital ou rente) en CHF. Positive = bon. */
  retirementGain?: number;
  /** Libellé du gain retraite (ex: "Capital LPP supplémentaire" / "Rente annuelle en plus"). */
  retirementGainLabel?: string;
  /** % d'amélioration global (0..1 ou -1..1). */
  deltaPercent?: number;
  /** Label personnalisé pour le % de delta (défaut : "Amélioration globale"). */
  deltaLabel?: string;
}

interface Props {
  /** Titre optionnel au-dessus du bloc. */
  title?: string;
  /** Sous-titre du bloc. */
  description?: string;
  /** Libellé de la colonne gauche (défaut: "Situation actuelle"). */
  currentLabel?: string;
  /** Libellé de la colonne droite (défaut: "Situation projetée"). */
  projectedLabel?: string;
  /** Sous-titre colonne gauche (ex: "Données fiche client"). */
  currentSubtitle?: string;
  /** Sous-titre colonne droite. */
  projectedSubtitle?: string;
  /** Lignes comparatives. */
  rows: SplitRow[];
  /** Bandeau synthèse en bas. */
  summary?: SplitSummary;
  /** Contenu additionnel injecté sous le bloc colonne courante. */
  currentExtra?: ReactNode;
  /** Contenu additionnel injecté sous le bloc colonne projetée. */
  projectedExtra?: ReactNode;
  className?: string;
}

function formatValue(v: SplitRow["current"], fmt: SplitRowFormat | undefined): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (fmt === "pct") return formatPct(v);
  if (fmt === "text") return String(v);
  if (fmt === "chf_per_month") return `${formatCHF(v)} / mois`;
  return formatCHF(v);
}

function computeDelta(row: SplitRow): { value: number; label: string; tone: "good" | "bad" | "neutral" } | null {
  if (typeof row.current !== "number" || typeof row.projected !== "number") return null;
  const delta = row.projected - row.current;
  if (delta === 0) return { value: 0, label: "—", tone: "neutral" };
  const better = row.betterWhen ?? "higher";
  const tone: "good" | "bad" | "neutral" =
    better === "neutral"
      ? "neutral"
      : (better === "higher" && delta > 0) || (better === "lower" && delta < 0)
        ? "good"
        : "bad";
  const sign = delta > 0 ? "+" : "−";
  const abs = Math.abs(delta);
  const label =
    row.format === "pct"
      ? `${sign}${formatPct(abs)}`
      : row.format === "chf_per_month"
        ? `${sign}${formatCHF(abs)} / mois`
        : `${sign}${formatCHF(abs)}`;
  return { value: delta, label, tone };
}

export function SplitCompareLayout({
  title,
  description,
  currentLabel = "Situation actuelle",
  projectedLabel = "Situation projetée",
  currentSubtitle = "Données fiche client",
  projectedSubtitle = "Optimisation recommandée",
  rows,
  summary,
  currentExtra,
  projectedExtra,
  className,
}: Props) {
  return (
    <div className={cn("space-y-4", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Sparkles className="h-4 w-4 text-primary" />
              {title}
            </h3>
          )}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Colonne ACTUELLE */}
        <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-destructive" aria-hidden />
                <h4 className="text-sm font-bold uppercase tracking-wider text-destructive">
                  {currentLabel}
                </h4>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{currentSubtitle}</p>
            </div>
            <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-[10px] text-destructive">
              Actuel
            </Badge>
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div
                key={`cur-${i}`}
                className="flex items-baseline justify-between gap-3 border-b border-destructive/15 pb-1.5 last:border-0 last:pb-0"
              >
                <span className="text-xs text-foreground/70">{r.label}</span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatValue(r.current, r.format)}
                </span>
              </div>
            ))}
          </div>
          {currentExtra && <div className="mt-3">{currentExtra}</div>}
        </div>

        {/* Colonne PROJETÉE */}
        <div className="relative rounded-2xl border-2 border-success/40 bg-gradient-to-br from-success/10 to-primary/5 p-4 shadow-md">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-success" aria-hidden />
                <h4 className="text-sm font-bold uppercase tracking-wider text-success">
                  {projectedLabel}
                </h4>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{projectedSubtitle}</p>
            </div>
            <Badge className="bg-success/20 text-[10px] text-success-foreground">
              <Sparkles className="mr-1 h-3 w-3" /> Optimisé
            </Badge>
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => {
              const delta = computeDelta(r);
              return (
                <div
                  key={`proj-${i}`}
                  className="flex items-baseline justify-between gap-3 border-b border-success/20 pb-1.5 last:border-0 last:pb-0"
                >
                  <span className="text-xs text-foreground/70">{r.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatValue(r.projected, r.format)}
                    </span>
                    {delta && delta.value !== 0 && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                          delta.tone === "good"
                            ? "bg-success/20 text-success"
                            : delta.tone === "bad"
                              ? "bg-destructive/15 text-destructive"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {delta.tone === "good" ? (
                          <TrendingUp className="h-2.5 w-2.5" />
                        ) : delta.tone === "bad" ? (
                          <TrendingDown className="h-2.5 w-2.5" />
                        ) : (
                          <Minus className="h-2.5 w-2.5" />
                        )}
                        {delta.label}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {projectedExtra && <div className="mt-3">{projectedExtra}</div>}
          {/* Flèche centrale (desktop) */}
          <div className="pointer-events-none absolute -left-3 top-1/2 hidden -translate-y-1/2 lg:block">
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow">
              <ArrowRight className="h-3 w-3 text-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Bandeau synthèse */}
      {summary && (summary.annualSaving !== undefined || summary.retirementGain !== undefined || summary.deltaPercent !== undefined) && (
        <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-r from-primary/10 via-success/10 to-primary/5 p-4 shadow-md">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {summary.annualSaving !== undefined && (
              <SummaryStat
                label="💰 Économie annuelle"
                value={formatCHF(summary.annualSaving)}
                tone={summary.annualSaving >= 0 ? "good" : "bad"}
              />
            )}
            {summary.retirementGain !== undefined && (
              <SummaryStat
                label={`📈 ${summary.retirementGainLabel ?? "Gain retraite"}`}
                value={formatCHF(summary.retirementGain)}
                tone={summary.retirementGain >= 0 ? "good" : "bad"}
              />
            )}
            {summary.deltaPercent !== undefined && (
              <SummaryStat
                label={`Δ ${summary.deltaLabel ?? "Amélioration"}`}
                value={formatPct(summary.deltaPercent)}
                tone={summary.deltaPercent >= 0 ? "good" : "bad"}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "bad";
}) {
  return (
    <div className="text-center sm:text-left">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          tone === "good" ? "text-success" : "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}
