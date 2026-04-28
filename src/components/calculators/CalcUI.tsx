// Petits composants réutilisables pour les calculateurs.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatCHF, formatPct } from "@/lib/format";

export function CalcCard({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6",
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
    <div className={cn("rounded-xl border p-4", toneCls)}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 font-semibold tabular-nums", big ? "text-2xl" : "text-xl")}>
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
