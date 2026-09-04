// Registre des pages légales publiques (footer + navigation croisée entre
// documents). Une seule source de vérité pour l'URL et le titre affiché,
// pour ne pas les faire diverger entre le footer et les pages elles-mêmes.
export interface LegalPageMeta {
  path: string;
  title: string;
}

export const LEGAL_PAGES: LegalPageMeta[] = [
  { path: "/legal/mentions-legales", title: "Mentions légales" },
  { path: "/legal/cgv", title: "Conditions générales de vente et d'utilisation" },
  { path: "/legal/confidentialite", title: "Politique de confidentialité" },
  { path: "/legal/cookies", title: "Politique relative aux cookies" },
  { path: "/legal/dpa", title: "Accord de traitement des données (DPA)" },
  { path: "/legal/notice-ia", title: "Notice relative à l'intelligence artificielle" },
  { path: "/legal/sous-traitants", title: "Registre des sous-traitants techniques" },
];
