// Coefficients / multiplicateurs communaux ICC réels par commune (2026).
// Source : tableur fourni par la courtière, compilé depuis les sources
// officielles cantonales (État de Genève ArCA-2026, VD taux 2026, VS
// coefficients + indexations 2022-2027, FR/NE tableaux 2026/2024-2026,
// JU quotités 2026). Remplace, quand la commune du client est connue et
// présente ici, le multiplicateur par défaut du chef-lieu cantonal
// (CANTON_SCALES[canton].communalMultiplierCapital dans src/lib/tax/cantons.ts).
//
// Unités d'origine et conversion vers le multiplicateur décimal attendu par
// computeCantonalCommunal (voir communalMult = simple * communalMult) :
//   GE centimes additionnels, VD/FR/NE coefficient en % → valeur / 100
//   JU quotité communale, VS coefficient communal (1.0-1.5) → valeur brute
//
// VS : en plus du coefficient, chaque commune a sa propre "indexation"
// (143%-176%), un second paramètre officiel (Service cantonal des
// contributions, page "Calcul du taux pour l'impôt communal") qui ajuste
// le revenu déterminant le TAUX avant application du coefficient — voir
// vsDeindexedReferenceIncome dans src/lib/tax/cantons.ts. Les 23 valeurs
// ci-dessous ont été recoupées une à une (coefficient ET indexation) avec
// le tableau officiel complet des 122 communes valaisannes (vs.ch/web/scc,
// "Coefficients_Indexations_Communes_2022-2027", colonne 2026) : les 23
// coefficients concordent exactement, confirmant aussi les indexations.
//
// JU : les 13 communes ci-dessous sont marquées "à recouper" (non encore
// confirmées en recoupement direct du PDF communal complet) dans le
// fichier source — verified: "provisional". À remplacer dès confirmation.

export interface CommunalMultiplierEntry {
  /** Multiplicateur décimal prêt à l'emploi (communalMultiplier). */
  multiplier: number;
  /** Commune fiscale 2026 réelle (après fusions) si différente de la clé. */
  fiscalCommune?: string;
  verified: "confirmed" | "provisional";
  /** VS uniquement : indexation communale réelle 2026 (%, ex. 166 pour 166%). */
  vsIndexationPercent?: number;
}

export const COMMUNAL_MULTIPLIERS: Record<string, Record<string, CommunalMultiplierEntry>> = {
  GE: {
    "Aire-la-Ville": { multiplier: 0.5, verified: "confirmed" },
    Anières: { multiplier: 0.31, verified: "confirmed" },
    Avully: { multiplier: 0.51, verified: "confirmed" },
    Avusy: { multiplier: 0.49, verified: "confirmed" },
    Bardonnex: { multiplier: 0.43, verified: "confirmed" },
    Bernex: { multiplier: 0.48, verified: "confirmed" },
    Carouge: { multiplier: 0.4, verified: "confirmed" },
    Cartigny: { multiplier: 0.42, verified: "confirmed" },
    Chancy: { multiplier: 0.51, verified: "confirmed" },
    Choulex: { multiplier: 0.4, verified: "confirmed" },
    "Chêne-Bougeries": { multiplier: 0.32, verified: "confirmed" },
    "Chêne-Bourg": { multiplier: 0.46, verified: "confirmed" },
    "Collonge-Bellerive": { multiplier: 0.28, verified: "confirmed" },
    Cologny: { multiplier: 0.25, verified: "confirmed" },
    Confignon: { multiplier: 0.46, verified: "confirmed" },
    Corsier: { multiplier: 0.31, verified: "confirmed" },
    Céligny: { multiplier: 0.33, verified: "confirmed" },
    Dardagny: { multiplier: 0.48, verified: "confirmed" },
    Genthod: { multiplier: 0.25, verified: "confirmed" },
    "Grand-Saconnex": { multiplier: 0.44, verified: "confirmed" },
    Gy: { multiplier: 0.46, verified: "confirmed" },
    Hermance: { multiplier: 0.42, verified: "confirmed" },
    Jussy: { multiplier: 0.41, verified: "confirmed" },
    Laconnex: { multiplier: 0.44, verified: "confirmed" },
    Lancy: { multiplier: 0.47, verified: "confirmed" },
    Meinier: { multiplier: 0.42, verified: "confirmed" },
    Meyrin: { multiplier: 0.42, verified: "confirmed" },
    Onex: { multiplier: 0.505, verified: "confirmed" },
    "Perly-Certoux": { multiplier: 0.43, verified: "confirmed" },
    "Plan-les-Ouates": { multiplier: 0.37, verified: "confirmed" },
    "Pregny-Chambésy": { multiplier: 0.32, verified: "confirmed" },
    Presinge: { multiplier: 0.4, verified: "confirmed" },
    Puplinge: { multiplier: 0.49, verified: "confirmed" },
    Russin: { multiplier: 0.39, verified: "confirmed" },
    Satigny: { multiplier: 0.39, verified: "confirmed" },
    Soral: { multiplier: 0.44, verified: "confirmed" },
    Thônex: { multiplier: 0.44, verified: "confirmed" },
    Troinex: { multiplier: 0.4, verified: "confirmed" },
    Vandœuvres: { multiplier: 0.27, verified: "confirmed" },
    Vernier: { multiplier: 0.5, verified: "confirmed" },
    Versoix: { multiplier: 0.455, verified: "confirmed" },
    Veyrier: { multiplier: 0.37, verified: "confirmed" },
  },
  VD: {
    Aigle: { multiplier: 0.66, verified: "confirmed" },
    Bex: { multiplier: 0.71, verified: "confirmed" },
    Bussigny: { multiplier: 0.625, verified: "confirmed" },
    "Chavannes-près-Renens": { multiplier: 0.775, verified: "confirmed" },
    "Cheseaux-sur-Lausanne": { multiplier: 0.73, verified: "confirmed" },
    Coppet: { multiplier: 0.57, verified: "confirmed" },
    Crissier: { multiplier: 0.635, verified: "confirmed" },
    Cully: { multiplier: 0.625, fiscalCommune: "Bourg-en-Lavaux", verified: "confirmed" },
    Echallens: { multiplier: 0.725, verified: "confirmed" },
    Ecublens: { multiplier: 0.625, verified: "confirmed" },
    Epalinges: { multiplier: 0.645, verified: "confirmed" },
    Founex: { multiplier: 0.57, verified: "confirmed" },
    Gland: { multiplier: 0.61, verified: "confirmed" },
    Grandson: { multiplier: 0.69, verified: "confirmed" },
    "La Tour-de-Peilz": { multiplier: 0.64, verified: "confirmed" },
    "Le Mont-sur-Lausanne": { multiplier: 0.72, verified: "confirmed" },
    Lutry: { multiplier: 0.54, verified: "confirmed" },
    Montreux: { multiplier: 0.65, verified: "confirmed" },
    Morges: { multiplier: 0.67, verified: "confirmed" },
    Moudon: { multiplier: 0.725, verified: "confirmed" },
    Nyon: { multiplier: 0.61, verified: "confirmed" },
    Orbe: { multiplier: 0.755, verified: "confirmed" },
    Payerne: { multiplier: 0.7, verified: "confirmed" },
    Prilly: { multiplier: 0.725, verified: "confirmed" },
    Préverenges: { multiplier: 0.65, verified: "confirmed" },
    Pully: { multiplier: 0.61, verified: "confirmed" },
    Renens: { multiplier: 0.77, verified: "confirmed" },
    Rolle: { multiplier: 0.595, verified: "confirmed" },
    "Saint-Prex": { multiplier: 0.59, verified: "confirmed" },
    "Sainte-Croix": { multiplier: 0.7, verified: "confirmed" },
    Vevey: { multiplier: 0.745, verified: "confirmed" },
    "Yverdon-les-Bains": { multiplier: 0.75, verified: "confirmed" },
  },
  VS: {
    Ardon: { multiplier: 1.3, verified: "confirmed", vsIndexationPercent: 166 },
    Bagnes: {
      multiplier: 1,
      fiscalCommune: "Val de Bagnes",
      verified: "confirmed",
      vsIndexationPercent: 176,
    },
    "Brigue-Glis": {
      multiplier: 1,
      fiscalCommune: "Brig/Glis",
      verified: "confirmed",
      vsIndexationPercent: 176,
    },
    Chamoson: { multiplier: 1.25, verified: "confirmed", vsIndexationPercent: 143 },
    Conthey: { multiplier: 1.2, verified: "confirmed", vsIndexationPercent: 163 },
    "Crans-Montana": { multiplier: 1.15, verified: "confirmed", vsIndexationPercent: 176 },
    Fully: { multiplier: 1.2, verified: "confirmed", vsIndexationPercent: 165 },
    Grimisuat: { multiplier: 1.25, verified: "confirmed", vsIndexationPercent: 163 },
    Hérémence: { multiplier: 1, verified: "confirmed", vsIndexationPercent: 176 },
    Martigny: { multiplier: 1.1, verified: "confirmed", vsIndexationPercent: 166 },
    Monthey: { multiplier: 1.2, verified: "confirmed", vsIndexationPercent: 170 },
    Naters: { multiplier: 1.1, verified: "confirmed", vsIndexationPercent: 176 },
    Nendaz: { multiplier: 1.3, verified: "confirmed", vsIndexationPercent: 156 },
    Riddes: { multiplier: 1.25, verified: "confirmed", vsIndexationPercent: 153 },
    "Saint-Maurice": { multiplier: 1.25, verified: "confirmed", vsIndexationPercent: 163 },
    Savièse: { multiplier: 1.15, verified: "confirmed", vsIndexationPercent: 156 },
    Saxon: { multiplier: 1.2, verified: "confirmed", vsIndexationPercent: 166 },
    Sierre: { multiplier: 1.2, verified: "confirmed", vsIndexationPercent: 161 },
    Verbier: {
      multiplier: 1,
      fiscalCommune: "Val de Bagnes",
      verified: "confirmed",
      vsIndexationPercent: 176,
    },
    Viège: {
      multiplier: 1.1,
      fiscalCommune: "Visp",
      verified: "confirmed",
      vsIndexationPercent: 176,
    },
    Vouvry: { multiplier: 1.25, verified: "confirmed", vsIndexationPercent: 158 },
    Vétroz: { multiplier: 1.15, verified: "confirmed", vsIndexationPercent: 163 },
    Zermatt: { multiplier: 1, verified: "confirmed", vsIndexationPercent: 176 },
  },
  FR: {
    Belfaux: { multiplier: 0.84, verified: "confirmed" },
    Bulle: { multiplier: 0.743, verified: "confirmed" },
    "Châtel-Saint-Denis": { multiplier: 0.836, verified: "confirmed" },
    Düdingen: { multiplier: 0.82, verified: "confirmed" },
    Estavayer: { multiplier: 0.84, verified: "confirmed" },
    Givisiez: { multiplier: 0.7, verified: "confirmed" },
    "Granges-Paccot": { multiplier: 0.678, verified: "confirmed" },
    Gruyères: { multiplier: 0.8, verified: "confirmed" },
    Guin: { multiplier: 0.82, verified: "confirmed" },
    Kerzers: { multiplier: 0.79, verified: "confirmed" },
    "Le Mouret": { multiplier: 0.845, verified: "confirmed" },
    Marly: { multiplier: 0.89, verified: "confirmed" },
    Murten: { multiplier: 0.62, verified: "confirmed" },
    Romont: { multiplier: 0.9, verified: "confirmed" },
    Tafers: { multiplier: 0.75, verified: "confirmed" },
    "Villars-sur-Glâne": { multiplier: 0.639, verified: "confirmed" },
  },
  NE: {
    Boudry: { multiplier: 0.68, verified: "confirmed" },
    Cernier: { multiplier: 0.66, fiscalCommune: "Val-de-Ruz", verified: "confirmed" },
    Colombier: { multiplier: 0.63, fiscalCommune: "Milvignes", verified: "confirmed" },
    Cortaillod: { multiplier: 0.66, verified: "confirmed" },
    Couvet: { multiplier: 0.76, fiscalCommune: "Val-de-Travers", verified: "confirmed" },
    Fleurier: { multiplier: 0.76, fiscalCommune: "Val-de-Travers", verified: "confirmed" },
    Hauterive: { multiplier: 0.68, fiscalCommune: "Laténa", verified: "confirmed" },
    "La Chaux-de-Fonds": { multiplier: 0.75, verified: "confirmed" },
    "Le Locle": { multiplier: 0.69, verified: "confirmed" },
    "Marin-Epagnier": { multiplier: 0.68, fiscalCommune: "Laténa", verified: "confirmed" },
    Peseux: { multiplier: 0.65, fiscalCommune: "Neuchâtel", verified: "confirmed" },
    "Saint-Blaise": { multiplier: 0.68, fiscalCommune: "Laténa", verified: "confirmed" },
    "Val-de-Ruz": { multiplier: 0.66, verified: "confirmed" },
    "Val-de-Travers": { multiplier: 0.76, verified: "confirmed" },
  },
  JU: {
    Alle: { multiplier: 2.25, verified: "provisional" },
    Bassecourt: { multiplier: 2.1, fiscalCommune: "Haute-Sorne", verified: "provisional" },
    Boncourt: { multiplier: 1.55, verified: "provisional" },
    Courrendlin: { multiplier: 2.25, verified: "provisional" },
    Courroux: { multiplier: 2.15, verified: "provisional" },
    Courtételle: { multiplier: 1.65, verified: "provisional" },
    Develier: { multiplier: 1.95, verified: "provisional" },
    "Le Noirmont": { multiplier: 1.3, verified: "provisional" },
    "Les Breuleux": { multiplier: 1.3, verified: "provisional" },
    Movelier: { multiplier: 2.25, verified: "provisional" },
    Porrentruy: { multiplier: 2.05, verified: "provisional" },
    Saignelégier: { multiplier: 2.3, verified: "provisional" },
    Vicques: { multiplier: 2.2, fiscalCommune: "Val Terbi", verified: "provisional" },
  },
};

/**
 * Multiplicateur communal réel pour une commune donnée, si connue.
 * undefined si canton/commune absent de la liste → l'appelant garde le
 * comportement existant (chef-lieu par défaut via communalMultiplierCapital).
 */
export function getCommunalMultiplier(
  canton: string | null | undefined,
  commune: string | null | undefined,
): number | undefined {
  if (!canton || !commune) return undefined;
  const entry = COMMUNAL_MULTIPLIERS[canton.toUpperCase()]?.[commune.trim()];
  return entry?.multiplier;
}

/**
 * VS uniquement : indexation communale réelle pour une commune donnée, si
 * connue. undefined pour tout autre canton, ou si la commune est absente de
 * la liste → l'appelant garde le comportement existant (taux lu directement
 * sur le revenu réel, sans dé-indexation).
 */
export function getVsIndexation(
  canton: string | null | undefined,
  commune: string | null | undefined,
): number | undefined {
  if (!canton || canton.toUpperCase() !== "VS" || !commune) return undefined;
  const entry = COMMUNAL_MULTIPLIERS.VS?.[commune.trim()];
  return entry?.vsIndexationPercent;
}
