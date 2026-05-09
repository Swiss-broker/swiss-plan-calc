// Bandeau persistant affiché en haut d'un calculateur quand il est ouvert
// avec ?clientId=xxx. Indique clairement le mode "lié à un dossier".

import { Link } from "@tanstack/react-router";
import { ArrowLeft, UserCircle2 } from "lucide-react";
import type { Client } from "@/lib/clients/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getClientDisplayName } from "@/lib/clients/to-calculator-input";
import { useT } from "@/contexts/LanguageContext";

export function ClientLinkBanner({ client }: { client: Client }) {
  const t = useT();
  return (
    <div
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 px-4 py-3"
      role="status"
      aria-live="polite"
    >
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
      <Link to="/clients/$clientId" params={{ clientId: client.id }}>
        <Button variant="outline" size="sm">
          <ArrowLeft className="h-4 w-4" /> {t("client_link.back_to_file")}
        </Button>
      </Link>
    </div>
  );
}
