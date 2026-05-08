// Liste des communes prioritaires par canton (Suisse romande v1).
// Auto-complétion dans le wizard client. Saisie libre acceptée hors liste.

export const COMMUNES_BY_CANTON: Record<string, string[]> = {
  GE: [
    "Genève", "Carouge", "Lancy", "Vernier", "Meyrin", "Onex", "Thônex",
    "Versoix", "Plan-les-Ouates", "Chêne-Bougeries", "Chêne-Bourg", "Grand-Saconnex",
    "Bernex", "Veyrier", "Cologny", "Pregny-Chambésy", "Satigny", "Collonge-Bellerive",
    "Confignon", "Vandœuvres", "Anières", "Bardonnex", "Choulex", "Corsier",
    "Hermance", "Jussy", "Laconnex", "Meinier", "Perly-Certoux", "Plan-les-Ouates",
    "Presinge", "Puplinge", "Russin", "Soral", "Troinex", "Avully", "Avusy",
    "Cartigny", "Céligny", "Chancy", "Choulex", "Dardagny", "Genthod",
    "Gy", "Aire-la-Ville",
  ],
  VD: [
    "Lausanne", "Yverdon-les-Bains", "Montreux", "Renens", "Nyon", "Vevey",
    "Pully", "Morges", "Gland", "Prilly", "La Tour-de-Peilz", "Ecublens",
    "Crissier", "Aigle", "Bex", "Chavannes-près-Renens", "Lutry", "Epalinges",
    "Le Mont-sur-Lausanne", "Bussigny", "Cheseaux-sur-Lausanne", "Payerne",
    "Rolle", "Préverenges", "Founex", "Coppet", "Saint-Prex", "Cully",
    "Grandson", "Orbe", "Sainte-Croix", "Moudon", "Echallens",
  ],
  VS: [
    "Sion", "Sierre", "Martigny", "Monthey", "Brigue-Glis", "Viège",
    "Conthey", "Saint-Maurice", "Vétroz", "Naters", "Fully", "Bagnes",
    "Saxon", "Vouvry", "Riddes", "Ardon", "Chamoson", "Verbier",
    "Crans-Montana", "Zermatt", "Grimisuat", "Savièse", "Nendaz", "Hérémence",
  ],
  FR: [
    "Fribourg", "Bulle", "Villars-sur-Glâne", "Marly", "Châtel-Saint-Denis",
    "Düdingen", "Estavayer", "Romont", "Murten", "Givisiez", "Granges-Paccot",
    "Belfaux", "Le Mouret", "Gruyères", "Tafers", "Kerzers", "Guin",
  ],
  NE: [
    "Neuchâtel", "La Chaux-de-Fonds", "Le Locle", "Val-de-Ruz", "Val-de-Travers",
    "Boudry", "Peseux", "Colombier", "Hauterive", "Saint-Blaise", "Cortaillod",
    "Marin-Epagnier", "Cernier", "Couvet", "Fleurier",
  ],
  JU: [
    "Delémont", "Porrentruy", "Bassecourt", "Courrendlin", "Courroux",
    "Saignelégier", "Alle", "Boncourt", "Vicques", "Courtételle",
    "Develier", "Le Noirmont", "Les Breuleux", "Movelier",
  ],
  BE: [
    "Berne", "Bienne", "Moutier", "Saint-Imier", "Tavannes", "Tramelan",
    "Reconvilier", "Court", "La Neuveville", "Malleray",
  ],
};

export function getCommunesForCanton(canton: string | null | undefined): string[] {
  if (!canton) return [];
  return COMMUNES_BY_CANTON[canton.toUpperCase()] ?? [];
}
