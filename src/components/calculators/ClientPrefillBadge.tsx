import { CheckCircle2, AlertTriangle } from "lucide-react";
import { formatCHF } from "@/lib/format";

interface Props {
  show: boolean;
  clientName?: string;
}

/** Petit badge de confirmation : le champ est toujours identique à la valeur
 *  pré-remplie depuis la fiche client (n'a pas été modifié par le courtier
 *  depuis l'hydratation). Disparaît silencieusement dès que la valeur est
 *  modifiée — pour un contrôle explicite de l'écart avec un chiffre précis
 *  (ex. fortune), voir `ClientWealthCheck` ci-dessous. */
export function ClientPrefillBadge({ show, clientName }: Props) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
      {clientName ? `Depuis la fiche de ${clientName}` : "Depuis la fiche client"}
    </span>
  );
}

interface WealthCheckProps {
  /** Valeur actuelle du champ dans le formulaire du calculateur. */
  value: number | undefined;
  /** Fortune nette calculée depuis la fiche client (client_assets) —
   *  undefined si aucun client n'est lié ou si son patrimoine n'est pas
   *  renseigné (dans ce cas, aucun contrôle n'est possible ni affiché). */
  clientValue: number | undefined;
  clientName?: string;
}

/** Contrôle de cohérence fortune : compare la valeur saisie dans le
 *  calculateur à la fortune nette déclarée sur la fiche client
 *  (client_assets, via computeFortune). Un écart peut fausser l'impôt sur
 *  la fortune affiché sans que le courtier s'en rende compte — contrairement
 *  à ClientPrefillBadge (silencieux en cas d'écart), ce contrôle affiche
 *  toujours un état explicite (conforme ou écart chiffré) dès qu'un client
 *  est lié. */
export function ClientWealthCheck({ value, clientValue, clientName }: WealthCheckProps) {
  if (clientValue == null) return null;
  const current = value ?? 0;
  const matches = Math.round(current) === Math.round(clientValue);
  const who = clientName ? ` de ${clientName}` : " client";
  if (matches) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
        Conforme à la fiche{who}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-warning">
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
      Diffère de la fiche{who} ({formatCHF(clientValue)})
    </span>
  );
}
