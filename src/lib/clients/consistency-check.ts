// Détecte les incohérences logiques entre champs de la fiche client
// (permis vs résidence, statut fiscal vs permis/canton, état civil vs
// conjoint, dates). Ce ne sont QUE des contradictions administrativement
// impossibles ou des erreurs de saisie manifestes (ex. permis G = travaille
// en Suisse en habitant à l'étranger, donc incompatible avec une résidence
// en Suisse) — jamais une estimation fiscale ou une règle incertaine. Le
// courtier garde toujours la main : ce sont des avertissements, jamais des
// blocages (voir suggest-tax-status.ts, même principe).
import type { Permit, TaxStatus, CivilStatus } from "@/lib/swiss/enums";
import { ACCORD_1983_CANTONS } from "@/lib/clients/suggest-tax-status";

export interface ConsistencyIssue {
  /** Champs impliqués, pour pouvoir les mettre en évidence dans le formulaire. */
  fields: string[];
  message: string;
}

export interface ConsistencyCheckInput {
  date_of_birth?: string | null;
  nationality?: string | null;
  permit?: Permit | null;
  country_of_residence?: string | null;
  canton?: string | null;
  tax_status?: TaxStatus | null;
  civil_status?: CivilStatus | null;
  spouse_first_name?: string | null;
  spouse_last_name?: string | null;
  spouse_date_of_birth?: string | null;
  spouse_gross_annual_salary?: string | number | null;
  children?: { date_of_birth?: string | null }[] | null;
  arrival_year_ch?: string | number | null;
  cross_border_start_year?: string | number | null;
  avs_contribution_start_year?: string | number | null;
}

// Permis qui impliquent de résider EN Suisse (B/L/Ci/F : autorisations de
// séjour suisses ; C : établissement ; swiss : citoyen suisse, ne vit pas
// forcément en Suisse en réalité, mais dans cette fiche "swiss" sert de
// raccourci "résident suisse sans permis à saisir" — voir initialForm).
const SWISS_RESIDENCE_PERMITS = new Set<Permit>(["B", "C", "L", "Ci", "F", "swiss"]);

function yearOf(value?: string | null): number | null {
  if (!value) return null;
  const y = new Date(value).getFullYear();
  return Number.isFinite(y) ? y : null;
}

function numYear(value?: string | number | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function checkClientConsistency(input: ConsistencyCheckInput): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const permit = input.permit ?? null;
  const country = (input.country_of_residence ?? "").toUpperCase() || null;
  const canton = (input.canton ?? "").toUpperCase() || null;
  const nationality = (input.nationality ?? "").toUpperCase() || null;
  const taxStatus = input.tax_status ?? null;

  // ── Permis vs pays de résidence ──────────────────────────────────────
  if (permit === "G" && country === "CH") {
    issues.push({
      fields: ["permit", "country_of_residence"],
      message:
        "Permis G (frontalier) incompatible avec une résidence en Suisse : un frontalier habite dans un pays voisin et travaille en Suisse.",
    });
  }
  if (permit && SWISS_RESIDENCE_PERMITS.has(permit) && country && country !== "CH") {
    issues.push({
      fields: ["permit", "country_of_residence"],
      message: `Permis ${permit === "swiss" ? "citoyen suisse" : permit} incompatible avec une résidence hors de Suisse : ce permis suppose de résider en Suisse.`,
    });
  }
  if (permit === "swiss" && nationality && nationality !== "CH") {
    issues.push({
      fields: ["permit", "nationality"],
      message: "Permis « Suisse » incompatible avec une nationalité différente de CH.",
    });
  }

  // ── Statut fiscal vs permis ───────────────────────────────────────────
  if ((permit === "C" || permit === "swiss") && taxStatus === "source_taxed") {
    issues.push({
      fields: ["permit", "tax_status"],
      message:
        "Un permis C ou un citoyen suisse n'est jamais imposé à la source : statut fiscal probablement à corriger.",
    });
  }
  if (permit === "G" && taxStatus === "resident") {
    issues.push({
      fields: ["permit", "tax_status"],
      message:
        "Permis G (frontalier) incompatible avec « Résident(e) · taxation ordinaire » : un frontalier n'est pas résident fiscal suisse.",
    });
  }
  if (
    (permit === "C" || permit === "swiss") &&
    (taxStatus === "cross_border_fr_1983" || taxStatus === "cross_border_ge" || taxStatus === "tou")
  ) {
    issues.push({
      fields: ["permit", "tax_status"],
      message:
        "Un permis C ou un citoyen suisse ne peut pas avoir un statut frontalier ou TOU (régimes réservés aux permis B/L/G imposés à la source à l'origine).",
    });
  }

  // ── Statut fiscal vs canton ────────────────────────────────────────────
  if (taxStatus === "cross_border_ge" && canton && canton !== "GE") {
    issues.push({
      fields: ["tax_status", "canton"],
      message: "Statut « Frontalier(ère) Genève » incompatible avec un canton différent de GE.",
    });
  }
  if (taxStatus === "cross_border_fr_1983" && canton && !ACCORD_1983_CANTONS.has(canton)) {
    issues.push({
      fields: ["tax_status", "canton"],
      message:
        "Statut « Frontalier(ère) français · accord 1983 » incompatible avec ce canton : l'accord de 1983 ne couvre que VD, VS, NE, JU, FR, BE.",
    });
  }

  // ── État civil vs conjoint ─────────────────────────────────────────────
  const hasSpouseData =
    !!(input.spouse_first_name && input.spouse_first_name.trim()) ||
    !!(input.spouse_last_name && input.spouse_last_name.trim()) ||
    !!(input.spouse_date_of_birth && input.spouse_date_of_birth.trim()) ||
    !!numYear(input.spouse_gross_annual_salary);
  if (input.civil_status === "single" && hasSpouseData) {
    issues.push({
      fields: ["civil_status", "spouse_first_name"],
      message:
        "État civil « Célibataire » mais des informations de conjoint sont renseignées : à vérifier ou à effacer.",
    });
  }

  // ── Cohérence des dates ─────────────────────────────────────────────────
  const birthYear = yearOf(input.date_of_birth);
  const currentYear = new Date().getFullYear();
  if (birthYear !== null) {
    for (const child of input.children ?? []) {
      const childBirthYear = yearOf(child.date_of_birth);
      if (childBirthYear !== null && childBirthYear < birthYear) {
        issues.push({
          fields: ["children"],
          message: "Un enfant a une date de naissance antérieure à celle du client.",
        });
        break;
      }
    }
    const dateFields: { key: string; label: string; value: number | null }[] = [
      {
        key: "arrival_year_ch",
        label: "Année d'arrivée en Suisse",
        value: numYear(input.arrival_year_ch),
      },
      {
        key: "cross_border_start_year",
        label: "Début d'activité en Suisse",
        value: numYear(input.cross_border_start_year),
      },
      {
        key: "avs_contribution_start_year",
        label: "Début de cotisation AVS",
        value: numYear(input.avs_contribution_start_year),
      },
    ];
    for (const f of dateFields) {
      if (f.value === null) continue;
      if (f.value < birthYear) {
        issues.push({
          fields: [f.key],
          message: `« ${f.label} » (${f.value}) est antérieure à la naissance du client (${birthYear}).`,
        });
      } else if (f.value > currentYear + 1) {
        issues.push({
          fields: [f.key],
          message: `« ${f.label} » (${f.value}) est dans le futur.`,
        });
      }
    }
  }

  return issues;
}
