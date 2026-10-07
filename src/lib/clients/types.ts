import type { Database } from "@/integrations/supabase/types";

export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
export type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"];

export type ClientPension = Database["public"]["Tables"]["client_pension"]["Row"];
export type ClientAssets = Database["public"]["Tables"]["client_assets"]["Row"];
export type ClientNote = Database["public"]["Tables"]["client_notes"]["Row"];

export interface Child {
  first_name: string;
  date_of_birth: string; // ISO
  in_household: boolean;
}

export function parseChildren(value: unknown): Child[] {
  if (!Array.isArray(value)) return [];
  return value.filter((c): c is Child => {
    if (typeof c !== "object" || c === null) return false;
    const child = c as Partial<Child>;
    const hasName = typeof child.first_name === "string" && child.first_name.trim() !== "";
    const hasDob = typeof child.date_of_birth === "string" && child.date_of_birth.trim() !== "";
    // Ignore les lignes vides laissées par le wizard (ni nom ni date).
    return hasName || hasDob;
  });
}

/** Enfants "à charge" (case "Au foyer" de la fiche client) : seuls ceux-ci
 *  comptent pour tout calcul fiscal (statut monoparental, déduction enfant,
 *  barème H, quotient familial FR...) — un enfant déclaré mais non à charge
 *  (garde partagée, enfant majeur indépendant, etc.) ne doit RIEN changer au
 *  statut ni aux déductions du client. Voir mapStatus dans
 *  to-calculator-input.ts, qui applique déjà ce filtre pour le statut :
 *  toute donnée "nombre d'enfants" / "âges des enfants" transmise à un
 *  moteur fiscal doit utiliser CETTE fonction, jamais parseChildren brut. */
export function dependentChildren(value: unknown): Child[] {
  return parseChildren(value).filter((c) => c.in_household);
}

export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
