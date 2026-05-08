// Liste des pays (ISO-3166 alpha-2) avec libellés FR et ordre priorisé.
// Utilisé par CountryCombobox (nationalité, pays de résidence).

export interface Country {
  code: string; // ISO 3166-1 alpha-2
  name: string; // libellé FR
}

// Pays voisins / fréquents — épinglés en tête de liste.
export const PRIORITY_COUNTRIES: Country[] = [
  { code: "CH", name: "Suisse" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Allemagne" },
  { code: "IT", name: "Italie" },
  { code: "AT", name: "Autriche" },
  { code: "LI", name: "Liechtenstein" },
];

// Reste de l'UE (hors voisins déjà priorisés) — alphabétique.
export const EU_COUNTRIES: Country[] = [
  { code: "BE", name: "Belgique" },
  { code: "BG", name: "Bulgarie" },
  { code: "CY", name: "Chypre" },
  { code: "HR", name: "Croatie" },
  { code: "DK", name: "Danemark" },
  { code: "ES", name: "Espagne" },
  { code: "EE", name: "Estonie" },
  { code: "FI", name: "Finlande" },
  { code: "GR", name: "Grèce" },
  { code: "HU", name: "Hongrie" },
  { code: "IE", name: "Irlande" },
  { code: "LV", name: "Lettonie" },
  { code: "LT", name: "Lituanie" },
  { code: "LU", name: "Luxembourg" },
  { code: "MT", name: "Malte" },
  { code: "NL", name: "Pays-Bas" },
  { code: "PL", name: "Pologne" },
  { code: "PT", name: "Portugal" },
  { code: "CZ", name: "République tchèque" },
  { code: "RO", name: "Roumanie" },
  { code: "SK", name: "Slovaquie" },
  { code: "SI", name: "Slovénie" },
  { code: "SE", name: "Suède" },
];

// Reste du monde — alphabétique (sélection des nationalités les plus fréquentes
// pour le marché suisse romand : Royaume-Uni, USA, Canada, Brésil, etc.).
export const OTHER_COUNTRIES: Country[] = [
  { code: "ZA", name: "Afrique du Sud" },
  { code: "AL", name: "Albanie" },
  { code: "DZ", name: "Algérie" },
  { code: "AR", name: "Argentine" },
  { code: "AU", name: "Australie" },
  { code: "BR", name: "Brésil" },
  { code: "CM", name: "Cameroun" },
  { code: "CA", name: "Canada" },
  { code: "CL", name: "Chili" },
  { code: "CN", name: "Chine" },
  { code: "CO", name: "Colombie" },
  { code: "KR", name: "Corée du Sud" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "EG", name: "Égypte" },
  { code: "AE", name: "Émirats arabes unis" },
  { code: "US", name: "États-Unis" },
  { code: "GE", name: "Géorgie" },
  { code: "IN", name: "Inde" },
  { code: "ID", name: "Indonésie" },
  { code: "IR", name: "Iran" },
  { code: "IL", name: "Israël" },
  { code: "JP", name: "Japon" },
  { code: "JO", name: "Jordanie" },
  { code: "LB", name: "Liban" },
  { code: "MG", name: "Madagascar" },
  { code: "MA", name: "Maroc" },
  { code: "MX", name: "Mexique" },
  { code: "NO", name: "Norvège" },
  { code: "NZ", name: "Nouvelle-Zélande" },
  { code: "PE", name: "Pérou" },
  { code: "PH", name: "Philippines" },
  { code: "GB", name: "Royaume-Uni" },
  { code: "RU", name: "Russie" },
  { code: "SN", name: "Sénégal" },
  { code: "RS", name: "Serbie" },
  { code: "SG", name: "Singapour" },
  { code: "SY", name: "Syrie" },
  { code: "TW", name: "Taïwan" },
  { code: "TH", name: "Thaïlande" },
  { code: "TN", name: "Tunisie" },
  { code: "TR", name: "Turquie" },
  { code: "UA", name: "Ukraine" },
  { code: "UY", name: "Uruguay" },
  { code: "VN", name: "Vietnam" },
];

export const ALL_COUNTRIES: Country[] = [
  ...PRIORITY_COUNTRIES,
  ...EU_COUNTRIES,
  ...OTHER_COUNTRIES,
];

const BY_CODE = new Map(ALL_COUNTRIES.map((c) => [c.code, c]));
export function countryName(code: string | null | undefined): string {
  if (!code) return "";
  return BY_CODE.get(code.toUpperCase())?.name ?? code;
}

export function countryLabel(c: Country): string {
  return `${c.name} (${c.code})`;
}
