// Début de cotisation AVS d'un client — source unique pour le calculateur
// AVS/AI (préremplissage), la fiche client et les prestations consolidées :
// trois formules locales différentes donnaient trois rentes différentes
// pour un même client arrivé en Suisse après ses 21 ans.

interface AvsCareerFields {
  avs_contribution_start_year?: number | string | null;
  cross_border_start_year?: number | string | null;
  arrival_year_ch?: number | string | null;
}

function yearOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Priorité : valeur explicite (avs_contribution_start_year) > début
 * d'activité en Suisse > année d'arrivée > 1er janvier suivant les 20 ans
 * (birthYear + 21, début de l'obligation générale de cotiser). Une arrivée
 * antérieure aux 21 ans ne fait pas démarrer la carrière AVS plus tôt.
 */
export function getAvsContributionStartYear(
  client: AvsCareerFields,
  birthYear: number,
): number {
  const defaultStart = birthYear + 21;
  const explicit = yearOrUndef(client.avs_contribution_start_year);
  if (explicit !== undefined) return explicit;
  const arrival =
    yearOrUndef(client.cross_border_start_year) ?? yearOrUndef(client.arrival_year_ch);
  return arrival !== undefined ? Math.max(arrival, defaultStart) : defaultStart;
}
