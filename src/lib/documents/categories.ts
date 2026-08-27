export const DOCUMENT_CATEGORIES = [
  { value: "attestation_lpp", label: "Attestation LPP / certificat de prévoyance" },
  { value: "libre_passage", label: "Police / compte de libre passage" },
  { value: "fiche_salaire", label: "Fiche de salaire" },
  { value: "declaration_fiscale", label: "Déclaration fiscale / taxation" },
  { value: "piece_identite", label: "Pièce d'identité" },
  { value: "police_3e_pilier", label: "Police 3e pilier (3a / 3b)" },
  { value: "police_lca", label: "Police LCA / assurance vie" },
  { value: "certificat_avs", label: "Certificat AVS / AI" },
  { value: "documents_bancaires", label: "Documents bancaires" },
  { value: "autres", label: "Autres" },
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]["value"];

export const CATEGORY_LABELS: Record<DocumentCategory, string> = Object.fromEntries(
  DOCUMENT_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<DocumentCategory, string>;

// "Où trouver ce document ?" : aide prudente affichée au courtier et au
// client. Volontairement formulée avec "généralement" : les démarches
// varient selon la caisse/l'assureur/le canton, ce texte n'est qu'une
// indication de départ, jamais une garantie.
export const DOCUMENT_HELP: Partial<Record<DocumentCategory, string>> = {
  attestation_lpp:
    "Généralement disponible sur le portail en ligne de votre caisse de pension, ou envoyée chaque année par courrier/e-mail. À défaut, votre employeur ou le service RH peut généralement vous orienter vers la caisse concernée.",
  libre_passage:
    "Généralement fourni par la fondation de libre passage (banque ou assurance) qui détient l'avoir depuis votre dernier changement d'emploi. Le nom de cette fondation figure généralement sur le dernier décompte reçu, ou peut être retrouvé via la Centrale du 2e pilier en cas de doute.",
  police_3e_pilier:
    "Généralement disponible dans l'espace client en ligne de votre banque ou assurance 3e pilier, ou sur la police papier reçue à l'ouverture du contrat.",
  certificat_avs:
    "Généralement téléchargeable sur le portail en ligne de votre caisse de compensation AVS cantonale, ou peut être demandé directement auprès d'elle.",
  declaration_fiscale:
    "Généralement disponible sur le portail cantonal des impôts en ligne, ou dans vos archives (copie envoyée avec la taxation définitive).",
  police_lca:
    "Généralement disponible dans l'espace client en ligne de votre assurance, ou sur le contrat papier reçu à la souscription.",
  autres:
    "Ce document dépend du cas précis, généralement transmis par l'organisme concerné (caisse, assurance, employeur, administration) directement ou via son portail en ligne.",
};

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.slice(0, 120) || "fichier";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
