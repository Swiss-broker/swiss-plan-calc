// Lien contextuel "Besoin d'aide sur cette page ?" vers l'article du wiki
// correspondant à l'écran affiché. Distinct de WikiTip (pastille d'aide
// posée sur un champ précis) : celui-ci se place en tête de page/onglet et
// pointe vers un article qui explique l'écran dans son ensemble.
import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function WikiHelpLink({
  article,
  className,
}: {
  /** Slug de l'article wiki ciblé (ex. "calc-budget"). */
  article: string;
  className?: string;
}) {
  return (
    <Link
      to="/wiki"
      search={{ article }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-primary hover:underline",
        className,
      )}
    >
      <BookOpen className="h-3.5 w-3.5" />
      Besoin d'aide sur cette page ?
    </Link>
  );
}
