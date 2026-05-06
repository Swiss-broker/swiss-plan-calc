// Petits composants réutilisables pour les calculateurs.
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatCHF, formatPct } from "@/lib/format";
import { useParallaxTilt } from "@/hooks/useParallaxTilt";

export function CalcCard({
  title,
  description,
  children,
  className,
  tilt = false,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  tilt?: boolean;
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
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
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
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning";
  big?: boolean;
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
      <div className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-foreground/80">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 truncate font-semibold tabular-nums transition-transform duration-300 group-hover:translate-y-[-1px]",
          big ? "text-2xl" : "text-xl",
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
}: {
  label: string;
  value: number | null | undefined;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning";
  big?: boolean;
}) {
  return <StatTile label={label} value={formatCHF(value ?? 0)} hint={hint} tone={tone} big={big} />;
}

export function PctTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | null | undefined;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning";
}) {
  return <StatTile label={label} value={formatPct(value ?? 0)} hint={hint} tone={tone} />;
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}
