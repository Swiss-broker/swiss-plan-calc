import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Info, BookOpen, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

/**
 * Pastille d'aide reliée à un article du Wiki.
 * Affiche une bulle au survol avec une explication courte + lien direct.
 */
export function WikiTip({
  tip,
  articleId,
  size = "sm",
  label = "Voir dans le wiki",
}: {
  tip: ReactNode;
  articleId: string;
  size?: "sm" | "md";
  label?: string;
}) {
  const dim = size === "md" ? "h-5 w-5" : "h-4 w-4";
  const icon = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";
  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label="Aide / wiki"
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
        className="max-w-xs space-y-2 text-left text-[12px] leading-snug"
      >
        <div>{tip}</div>
        <Link
          to="/wiki"
          search={{ article: articleId }}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary hover:text-primary-foreground"
        >
          <BookOpen className="h-3 w-3" />
          {label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </HoverCardContent>
    </HoverCard>
  );
}

/** Label avec un WikiTip directement collé. */
export function WikiLabel({
  children,
  tip,
  articleId,
  className,
}: {
  children: ReactNode;
  tip: ReactNode;
  articleId: string;
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
      <WikiTip tip={tip} articleId={articleId} />
    </Label>
  );
}
