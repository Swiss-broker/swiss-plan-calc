export const DOCUMENT_CATEGORIES = [
  { value: "attestation_lpp", label: "Attestation LPP / certificat de prévoyance" },
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
