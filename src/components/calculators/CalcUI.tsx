// Petits composants réutilisables pour les calculateurs.
import { useRef, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCHF, formatPct } from "@/lib/format";
import { useParallaxTilt } from "@/hooks/useParallaxTilt";
import { Label } from "@/components/ui/label";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

/**
 * Pastille d'aide TRÈS visible (badge bleu "i") qui ouvre une bulle
 * au survol ET au clic. Pensée pour ne jamais passer inaperçue.
 */
export function HelpDot({
  tip,
  size = "sm",
}: {
  tip: ReactNode;
  size?: "sm" | "md";
}) {
  const dim = size === "md" ? "h-5 w-5" : "h-4 w-4";
  const icon = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label="Aide"
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full",
            "bg-primary/15 text-primary ring-1 ring-primary/30",
            "transition-all hover:bg-primary hover:text-primary-foreground hover:ring-primary",
            "focus:outline-none focus:ring-2 focus:ring-primary",
            dim,
          )}
        >
          <Info className={icon} />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        className="max-w-xs text-left text-[12px] leading-snug"
      >
        {tip}
      </HoverCardContent>
    </HoverCard>
  );
}

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
    <Label
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      <span>{children}</span>
      <HelpDot tip={tip} />
    </Label>
  );
}

export function CalcCard({
  title,
  description,
  children,
  className,
  tilt = false,
  tip,
  "data-guide": dataGuide,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  tilt?: boolean;
  tip?: ReactNode;
  /** Id ciblé par GuideMode via data-guide="..." — voir components/calculators/GuideMode.tsx. */
  "data-guide"?: string;
}) {
  const tiltRef = useParallaxTilt<HTMLDivElement>({ max: 3, scale: 1.004 });
  const fallbackRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={tilt ? tiltRef : fallbackRef}
      data-guide={dataGuide}
      className={cn(
        "rounded-2xl border border-border bg-card bg-gradient-surface p-5 shadow-3d sm:p-6",
        tilt ? "tilt-3d" : "hover-lift",
        className,
      )}
    >
      {title ? (
        <div className="mb-4">
          <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            {title}
            {tip ? <HelpDot tip={tip} size="md" /> : null}
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
        ? "border-success/60 bg-success/15 ring-1 ring-success/30 shadow-[0_0_0_1px_color-mix(in_oklab,var(--success)_25%,transparent)]"
        : tone === "warning"
          ? "border-warning/30 bg-warning/5"
          : "border-border bg-muted/40";
  const valueToneCls =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "primary"
          ? "text-primary"
          : "";
  return (
    <div
      key={value}
      className={cn(
        "group min-w-0 rounded-xl border p-4 hover-lift kpi-pop",
        toneCls,
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase leading-tight tracking-wider text-muted-foreground transition-colors group-hover:text-foreground/80">
        <span>{label}</span>
        {tip ? <HelpDot tip={tip} /> : null}
      </div>
      <div
        className={cn(
          // whitespace-nowrap, jamais break-words : un montant CHF ne doit
          // jamais se couper en plein milieu d'un chiffre (repéré en test,
          // tuile "Net dirigeant" coupée "CHF 137'19" / "9" sur deux
          // lignes) — la taille réduite sur mobile (big ? text-xl : text-base)
          // laisse de la marge à la tuile plutôt que de forcer la coupure.
          "mt-1 whitespace-nowrap font-semibold leading-tight tabular-nums transition-transform duration-300 group-hover:translate-y-[-1px]",
          big ? "text-xl sm:text-2xl" : "text-base sm:text-lg md:text-xl",
          valueToneCls,
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
