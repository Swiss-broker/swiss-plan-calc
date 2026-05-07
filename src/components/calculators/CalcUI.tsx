// Petits composants réutilisables pour les calculateurs.
import { useRef, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCHF, formatPct } from "@/lib/format";
import { useParallaxTilt } from "@/hooks/useParallaxTilt";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Label avec icône info + tooltip explicatif.
 * À utiliser sur tous les champs/résultats où une explication métier aide à éviter une perte de temps.
 */
export function InfoLabel({
  children,
  tip,
  className,
}: {
  children: ReactNode;
  tip: ReactNode;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Label
        className={cn(
          "flex items-center gap-1 text-xs font-medium text-muted-foreground",
          className,
        )}
      >
        <span>{children}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-primary"
              aria-label="Aide"
            >
              <Info className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-left text-[11px] leading-snug">
            {tip}
          </TooltipContent>
        </Tooltip>
      </Label>
    </TooltipProvider>
  );
}

export function CalcCard({
  title,
  description,
  children,
  className,
  tilt = false,
  tip,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  tilt?: boolean;
  /** Tooltip optionnel affiché à côté du titre */
  tip?: ReactNode;
}) {
  const tiltRef = useParallaxTilt<HTMLDivElement>({ max: 3, scale: 1.004 });
  const fallbackRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={tilt ? tiltRef : fallbackRef}
      className={cn(
        "rounded-2xl border border-border bg-card bg-gradient-surface p-5 shadow-3d sm:p-6",
        tilt ? "tilt-3d" : "hover-lift",
        className,
      )}
    >
      {title ? (
        <div className="mb-4">
          <h3 className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
            {title}
            {tip ? (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-primary"
                      aria-label="Aide"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-left text-[11px] leading-snug">
                    {tip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  big = false,
  tip,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning";
  big?: boolean;
  tip?: ReactNode;
}) {
  const toneCls =
    tone === "primary"
      ? "border-primary/30 bg-primary/5"
      : tone === "success"
        ? "border-success/30 bg-success/5"
        : tone === "warning"
          ? "border-warning/30 bg-warning/5"
          : "border-border bg-muted/40";
  return (
    <div
      key={value}
      className={cn(
        "group min-w-0 rounded-xl border p-4 hover-lift kpi-pop",
        toneCls,
      )}
    >
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase leading-tight tracking-wider text-muted-foreground transition-colors group-hover:text-foreground/80">
        <span>{label}</span>
        {tip ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-3 w-3 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-primary"
                  aria-label="Aide"
                >
                  <Info className="h-2.5 w-2.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-left text-[11px] leading-snug normal-case tracking-normal">
                {tip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
      <div
        className={cn(
          "mt-1 break-words font-semibold leading-tight tabular-nums transition-transform duration-300 group-hover:translate-y-[-1px]",
          big ? "text-2xl" : "text-lg sm:text-xl",
        )}
        title={value}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function MoneyTile({
  label,
  value,
  hint,
  tone,
  big,
  compact = false,
  tip,
}: {
  label: string;
  value: number | null | undefined;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning";
  big?: boolean;
  /** Si true, n'affiche pas le préfixe "CHF" devant le montant */
  compact?: boolean;
  tip?: ReactNode;
}) {
  const formatted = compact
    ? new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 0 }).format(value ?? 0)
    : formatCHF(value ?? 0);
  return (
    <StatTile
      label={compact ? `${label} (CHF)` : label}
      value={formatted}
      hint={hint}
      tone={tone}
      big={big}
      tip={tip}
    />
  );
}

export function PctTile({
  label,
  value,
  hint,
  tone,
  tip,
}: {
  label: string;
  value: number | null | undefined;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning";
  tip?: ReactNode;
}) {
  return <StatTile label={label} value={formatPct(value ?? 0)} hint={hint} tone={tone} tip={tip} />;
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}
