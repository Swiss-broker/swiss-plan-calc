// Bandeau persistant affiché en haut d'un calculateur quand il est ouvert
// avec ?clientId=xxx. Indique clairement le mode "lié à un dossier".

import { Link } from "@tanstack/react-router";
import { ArrowLeft, UserCircle2 } from "lucide-react";
import type { Client } from "@/lib/clients/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getClientDisplayName } from "@/lib/clients/to-calculator-input";
import { useT } from "@/contexts/LanguageContext";

export function ClientLinkBanner({ client, caseId }: { client: Client; caseId?: string }) {
  const t = useT();
  return (
    <div
      className="mb-4 rounded-xl border-2 border-primary/30 bg-primary/5 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <UserCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-wider text-primary">
              {t("client_link.simulation_for")}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {getClientDisplayName(client)}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {t("client_link.prefilled_badge")}
              </Badge>
            </div>
          </div>
        </div>
        {caseId ? (
          // Un dossier est actif : on y reste ancré par défaut, pour que la
          // prochaine simulation lancée depuis cette fiche reste dans le
          // même dossier (voir le bug "Retour à la fiche" qui faisait
          // perdre le dossier actif et expédiait les simulations suivantes
          // hors de tout dossier, difficiles à retrouver ensuite).
          <div className="flex flex-col items-end gap-1">
            <Link to="/clients/$clientId/cases/$caseId" params={{ clientId: client.id, caseId }}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" /> Retour au dossier
              </Button>
            </Link>
            <Link
              to="/clients/$clientId"
              params={{ clientId: client.id }}
              className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Quitter vers la fiche client
            </Link>
          </div>
        ) : (
          <Link to="/clients/$clientId" params={{ clientId: client.id }}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" /> {t("client_link.back_to_file")}
            </Button>
          </Link>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {t("client_link.auto_save_note", { name: getClientDisplayName(client) })}
      </p>
    </div>
  );
}
