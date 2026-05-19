import { Sparkles, TrendingUp, AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { Optimization } from "@/lib/optimizer";
import { formatCHF } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const CATEGORY_LABELS: Record<Optimization["category"], string> = {
  lpp: "LPP",
  "3a": "Pilier 3a",
  canton: "Canton",
  wealth: "Fortune",
  withdrawal: "Retrait",
};

const PRIORITY_STYLES: Record<Optimization["priority"], string> = {
  high: "border-success/40 bg-success/5",
  medium: "border-primary/30 bg-primary/5",
  low: "border-border bg-muted/30",
};

const PRIORITY_LABEL: Record<Optimization["priority"], string> = {
  high: "Priorité haute",
  medium: "Recommandé",
  low: "À considérer",
};

export function OptimizationsPanel({
  optimizations,
  title = "Suggestions d'optimisation",
  emptyHint,
}: {
  optimizations: Optimization[];
  title?: string;
  emptyHint?: string;
}) {
  const totalSavings = optimizations.reduce((s, o) => s + o.estimatedSavings, 0);

  if (optimizations.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <h3 className="mt-3 text-base font-semibold">Aucune optimisation détectée</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {emptyHint ??
              "Renseignez davantage d'informations (LPP, 3a, fortune, canton) pour obtenir des recommandations chiffrées."}
          </p>
        </div>
        <Pillar3bInfoTile />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-tight">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {optimizations.length} pistes identifiées automatiquement
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Économie potentielle
          </div>
          <div className="text-xl font-bold tabular-nums text-success">
            {formatCHF(totalSavings)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {optimizations.map((o) => (
          <div
            key={o.id}
            className={cn(
              "rounded-xl border p-4 transition-shadow hover:shadow-sm",
              PRIORITY_STYLES[o.priority],
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {CATEGORY_LABELS[o.category]}
                  </Badge>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {PRIORITY_LABEL[o.priority]}
                  </span>
                </div>
                <h4 className="text-sm font-semibold">{o.title}</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {o.description}
                </p>
                {o.details && (
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3">
                    {Object.entries(o.details).map(([k, v]) => (
                      <div key={k} className="flex flex-col">
                        <span className="text-muted-foreground">{labelize(k)}</span>
                        <span className="font-medium tabular-nums">
                          {typeof v === "number" ? formatCHF(v) : v}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {o.warning && (
                  <div
                    className={cn(
                      "mt-3 flex gap-2 rounded-lg border-2 p-3",
                      o.warning.severity === "warning"
                        ? "border-warning/60 bg-warning/10"
                        : "border-primary/40 bg-primary/5",
                    )}
                    role="alert"
                  >
                    <AlertTriangle
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        o.warning.severity === "warning" ? "text-warning" : "text-primary",
                      )}
                    />
                    <div className="flex-1 space-y-1">
                      <p
                        className={cn(
                          "text-xs font-semibold",
                          o.warning.severity === "warning"
                            ? "text-warning-foreground"
                            : "text-foreground",
                        )}
                      >
                        ⚠ {o.warning.title}
                      </p>
                      <p className="whitespace-pre-line text-[11px] leading-relaxed text-foreground/80">
                        {o.warning.body}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <TrendingUp className="h-4 w-4 text-success" />
                <span className="text-base font-bold tabular-nums text-success">
                  {formatCHF(o.estimatedSavings)}
                </span>
                <span className="text-[10px] text-muted-foreground">/ économie</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        className="rounded-xl border border-dashed border-border bg-muted/30 p-4"
        role="note"
        aria-label="Information 3e pilier B"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Info className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold">3e pilier B (assurance-vie / épargne libre)</h4>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                Pas de scénario chiffré
              </Badge>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Le 3e pilier B n'est <strong>pas déductible au niveau fédéral (IFD)</strong>. Au niveau cantonal, les primes entrent dans un <strong>forfait global "primes d'assurance + intérêts d'épargne"</strong> plafonné (ex. GE : ~2 200 CHF seul / ~4 300 CHF couple), souvent déjà saturé par la LAMal et les intérêts bancaires. L'effet fiscal réel est donc <strong>quasi nul</strong> dans la plupart des situations, et <strong>inexistant pour un frontalier accord 1983</strong> (imposition en France). Le 3b reste pertinent pour la <strong>prévoyance, la protection des proches et la transmission</strong>, mais pas comme levier d'optimisation fiscale directe.
            </p>
          </div>
        </div>
      </div>

      <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Suggestions calculées sur la base des barèmes fiscaux 2026 et du statut fiscal du client. Pour les cas complexes (frontaliers TOU, structures holding, revenus internationaux), valider la cohérence des hypothèses avant remise au client.
      </p>
    </div>
  );
}

function labelize(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}
