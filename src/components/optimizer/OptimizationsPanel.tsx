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

export type Pillar3bContext = {
  canton?: string | null;
  civilStatus?: string | null;
  taxStatus?:
    | "resident_ordinary"
    | "resident"
    | "source_taxed"
    | "cross_border_fr_1983"
    | "cross_border_ge"
    | "tou"
    | "unknown"
    | null;
};

export function OptimizationsPanel({
  optimizations,
  title = "Suggestions d'optimisation",
  emptyHint,
  canton,
  civilStatus,
  taxStatus,
}: {
  optimizations: Optimization[];
  title?: string;
  emptyHint?: string;
} & Pillar3bContext) {
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
        <Pillar3bInfoTile canton={canton} civilStatus={civilStatus} taxStatus={taxStatus} />
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

      <Pillar3bInfoTile canton={canton} civilStatus={civilStatus} taxStatus={taxStatus} />

      <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Suggestions calculées sur la base des barèmes fiscaux 2026 et du statut fiscal du client.
        Pour les cas complexes (frontaliers TOU, structures holding, revenus internationaux),
        valider la cohérence des hypothèses avant remise au client.
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

const GE_LIMITS_2025 = {
  single: 2196,
  singleSelfEmployed: 4434,
  couple: 3292,
  coupleSelfEmployed: 6652,
  perChild: 900,
  perChildSelfEmployed: 1814,
};

const FR_LIMITS_2025 = {
  single: 750,
  couple: 1500,
};

function isCouple(civilStatus?: string | null): boolean {
  return civilStatus === "married" || civilStatus === "registered_partnership";
}

export function Pillar3bInfoTile({ canton, civilStatus, taxStatus }: Pillar3bContext) {
  const c = (canton ?? "").toUpperCase();
  const isGE = c === "GE";
  const isFR = c === "FR";
  const isFrontalier1983 = taxStatus === "cross_border_fr_1983";
  const eligible = (isGE || isFR) && !isFrontalier1983;
  const couple = isCouple(civilStatus);

  let statusBadge: { label: string; tone: "success" | "muted" | "warning" };
  let statusLine: string | null = null;

  if (isFrontalier1983) {
    statusBadge = {
      label: "Imposition en France — non applicable",
      tone: "warning",
    };
    statusLine =
      "En tant que frontalier sous l'accord 1983, votre revenu est imposé en France. Les déductions cantonales suisses (y compris 3b à GE/FR) n'ont aucun effet fiscal.";
  } else if (isGE) {
    const max = couple ? GE_LIMITS_2025.couple : GE_LIMITS_2025.single;
    const maxSelf = couple ? GE_LIMITS_2025.coupleSelfEmployed : GE_LIMITS_2025.singleSelfEmployed;
    statusBadge = { label: "Éligible — Genève", tone: "success" };
    statusLine = `Votre canton (GE) autorise une déduction 3b jusqu'à ${formatCHF(max)}/an${couple ? " (couple)" : " (célibataire)"}, ou ${formatCHF(maxSelf)} si indépendant. Supplément de ${formatCHF(GE_LIMITS_2025.perChild)} par enfant à charge.`;
  } else if (isFR) {
    const max = couple ? FR_LIMITS_2025.couple : FR_LIMITS_2025.single;
    statusBadge = { label: "Éligible — Fribourg", tone: "success" };
    statusLine = `Votre canton (FR) autorise une déduction 3b limitée à ${formatCHF(max)}/an${couple ? " (couple)" : " (célibataire)"}.`;
  } else {
    statusBadge = {
      label: canton ? `Non déductible — ${c}` : "Non déductible dans la plupart des cantons",
      tone: "muted",
    };
    statusLine = canton
      ? `Votre canton (${c}) ne prévoit pas de déduction spécifique pour le 3e pilier B. Aucun gain fiscal direct attendu.`
      : null;
  }

  const badgeClass =
    statusBadge.tone === "success"
      ? "border-success/40 bg-success/10 text-success-foreground"
      : statusBadge.tone === "warning"
        ? "border-warning/40 bg-warning/10 text-warning-foreground"
        : "border-border bg-muted text-muted-foreground";

  return (
    <div
      className="rounded-xl border border-dashed border-border bg-muted/30 p-4"
      role="note"
      aria-label="Information 3e pilier B"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Info className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold">3e pilier B (assurance-vie / épargne libre)</h4>
              <Badge
                variant="outline"
                className={cn("text-[10px] uppercase tracking-wider", badgeClass)}
              >
                {statusBadge.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Déductible uniquement à Genève et Fribourg, dans des limites cantonales spécifiques.
            </p>
          </div>

          <p className="text-xs leading-relaxed text-foreground/80">
            Le 3e pilier B n'est jamais déductible de l'impôt fédéral direct (IFD). Au niveau
            cantonal, la plupart des cantons ne prévoient aucune déduction spécifique pour le 3b —
            les primes entrent au mieux dans le forfait général "assurances et intérêts d'épargne",
            souvent déjà saturé par la LAMal. Seuls Genève et Fribourg accordent une déduction
            dédiée, plafonnée.
          </p>

          {statusLine && (
            <div
              className={cn(
                "rounded-lg border p-2.5 text-xs leading-relaxed",
                statusBadge.tone === "success"
                  ? "border-success/30 bg-success/5 text-foreground"
                  : statusBadge.tone === "warning"
                    ? "border-warning/40 bg-warning/10 text-foreground"
                    : "border-border bg-card text-foreground/80",
              )}
            >
              {statusLine}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Genève — plafonds 2025
              </div>
              <div className="mt-1 space-y-0.5 text-[11px] text-foreground/80">
                <div>
                  Célibataire : {formatCHF(GE_LIMITS_2025.single)} (
                  {formatCHF(GE_LIMITS_2025.singleSelfEmployed)} si indépendant)
                </div>
                <div>
                  Couple : {formatCHF(GE_LIMITS_2025.couple)} (
                  {formatCHF(GE_LIMITS_2025.coupleSelfEmployed)} si indépendants)
                </div>
                <div>
                  Par enfant : {formatCHF(GE_LIMITS_2025.perChild)} (
                  {formatCHF(GE_LIMITS_2025.perChildSelfEmployed)} si indépendants)
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Fribourg — plafonds 2025
              </div>
              <div className="mt-1 space-y-0.5 text-[11px] text-foreground/80">
                <div>Célibataire : {formatCHF(FR_LIMITS_2025.single)}</div>
                <div>Couple : {formatCHF(FR_LIMITS_2025.couple)}</div>
              </div>
            </div>
          </div>

          <p className="text-[11px] italic text-muted-foreground">
            Le 3b reste pertinent pour la prévoyance, la protection des proches et la transmission,
            mais ce n'est pas un levier d'optimisation fiscale dans la majorité des cas.
          </p>
        </div>
      </div>
    </div>
  );
}
