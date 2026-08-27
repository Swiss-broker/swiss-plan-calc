// Les 10 modèles d'e-mails par défaut. Personnalisables par courtier
// (voir email_templates en base : une ligne = une surcharge du modèle par
// défaut ci-dessous ; en son absence, c'est ce fichier qui fait foi).
// Ton volontairement professionnel, humain et sobre : pas de superlatifs,
// pas d'urgence artificielle, jamais de ton automatisé ou robotique.
export type TemplateKey =
  | "demande_documents"
  | "relance_j2"
  | "documents_manquants"
  | "confirmation_reception"
  | "rappel_rdv"
  | "confirmation_rdv"
  | "report_rdv"
  | "annulation_rdv"
  | "suivi_post_rdv"
  | "demande_complementaire";

export interface EmailTemplate {
  key: TemplateKey;
  label: string;
  subject: string;
  body: string;
}

// Variables disponibles, résolues automatiquement à partir du contexte
// (client, courtier, prochain rendez-vous, documents en attente) au
// moment d'ouvrir un modèle. Le courtier peut ensuite tout modifier
// librement avant l'envoi.
export const TEMPLATE_VARIABLES: { token: string; description: string }[] = [
  { token: "{{prenom}}", description: "Prénom du client" },
  { token: "{{nom}}", description: "Nom du client" },
  { token: "{{nom_courtier}}", description: "Votre nom" },
  { token: "{{cabinet}}", description: "Nom de votre cabinet" },
  { token: "{{date_rdv}}", description: "Date du rendez-vous" },
  { token: "{{heure_rdv}}", description: "Heure du rendez-vous" },
  { token: "{{documents_manquants}}", description: "Liste des documents encore attendus" },
  { token: "{{lien_depot}}", description: "Lien sécurisé de dépôt de documents" },
  { token: "{{signature}}", description: "Votre signature" },
];

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    key: "demande_documents",
    label: "Demande de documents",
    subject: "Documents nécessaires pour votre dossier",
    body: `Bonjour {{prenom}},

Pour avancer sur votre dossier, j'aurais besoin des documents suivants de votre part :

{{documents_manquants}}

Vous pouvez les déposer directement et en toute sécurité via ce lien :
{{lien_depot}}

N'hésitez pas à revenir vers moi si vous avez la moindre question.

{{signature}}`,
  },
  {
    key: "relance_j2",
    label: "Relance J+2",
    subject: "Petit rappel : documents en attente",
    body: `Bonjour {{prenom}},

Je me permets de revenir vers vous concernant les documents demandés il y a quelques jours. Je ne les ai pas encore reçus.

Voici de nouveau le lien pour les déposer :
{{lien_depot}}

Si vous rencontrez une difficulté pour les rassembler, dites-le-moi simplement, on trouvera une solution ensemble.

{{signature}}`,
  },
  {
    key: "documents_manquants",
    label: "Documents manquants",
    subject: "Il manque encore quelques documents",
    body: `Bonjour {{prenom}},

Merci pour les documents déjà transmis. Il en manque encore quelques-uns pour compléter votre dossier :

{{documents_manquants}}

Vous pouvez les ajouter via le même lien que précédemment :
{{lien_depot}}

Merci d'avance.

{{signature}}`,
  },
  {
    key: "confirmation_reception",
    label: "Confirmation de réception",
    subject: "Vos documents ont bien été reçus",
    body: `Bonjour {{prenom}},

Je confirme avoir bien reçu vos documents. Je les examine et reviens vers vous rapidement si besoin.

Merci pour votre réactivité.

{{signature}}`,
  },
  {
    key: "rappel_rdv",
    label: "Rappel rendez-vous",
    subject: "Rappel : votre rendez-vous du {{date_rdv}}",
    body: `Bonjour {{prenom}},

Petit rappel concernant notre rendez-vous prévu le {{date_rdv}} à {{heure_rdv}}.

N'hésitez pas à me contacter si vous avez besoin de le déplacer ou si vous avez des questions à préparer en amont.

À bientôt,

{{signature}}`,
  },
  {
    key: "confirmation_rdv",
    label: "Confirmation de rendez-vous",
    subject: "Confirmation de votre rendez-vous du {{date_rdv}}",
    body: `Bonjour {{prenom}},

Je vous confirme notre rendez-vous le {{date_rdv}} à {{heure_rdv}}.

Si ce créneau ne vous convient plus, n'hésitez pas à me le signaler dès que possible afin que nous en trouvions un autre.

Au plaisir de vous retrouver,

{{signature}}`,
  },
  {
    key: "report_rdv",
    label: "Report de rendez-vous",
    subject: "Report de notre rendez-vous",
    body: `Bonjour {{prenom}},

Je me permets de revenir vers vous concernant notre rendez-vous : il doit être reporté.

Le nouveau créneau proposé est le {{date_rdv}} à {{heure_rdv}}. Dites-moi si cela vous convient, sinon nous trouverons un autre moment ensemble.

Désolé pour la gêne occasionnée.

{{signature}}`,
  },
  {
    key: "annulation_rdv",
    label: "Annulation de rendez-vous",
    subject: "Annulation de notre rendez-vous",
    body: `Bonjour {{prenom}},

Je vous informe que notre rendez-vous du {{date_rdv}} à {{heure_rdv}} doit être annulé.

N'hésitez pas à me recontacter pour convenir d'un nouveau créneau quand cela vous conviendra.

{{signature}}`,
  },
  {
    key: "suivi_post_rdv",
    label: "Suivi post-rendez-vous",
    subject: "Suite à notre rendez-vous",
    body: `Bonjour {{prenom}},

Merci pour notre échange du {{date_rdv}}. J'espère qu'il vous a permis d'y voir plus clair sur votre situation.

Je reste à votre disposition pour toute question complémentaire, et reviendrai vers vous prochainement pour la suite.

{{signature}}`,
  },
  {
    key: "demande_complementaire",
    label: "Demande complémentaire",
    subject: "Une précision complémentaire",
    body: `Bonjour {{prenom}},

En complément de nos derniers échanges, j'aurais besoin d'une précision de votre part pour finaliser votre dossier.

N'hésitez pas à me répondre directement par e-mail, ou à me joindre par téléphone si c'est plus simple.

{{signature}}`,
  },
];

export const EMAIL_TEMPLATES_BY_KEY: Record<TemplateKey, EmailTemplate> = Object.fromEntries(
  EMAIL_TEMPLATES.map((t) => [t.key, t]),
) as Record<TemplateKey, EmailTemplate>;

// Remplace chaque {{variable}} connue par sa valeur ; les variables non
// résolues (ex. {{date_rdv}} sans rendez-vous associé) sont laissées
// visibles telles quelles, pour que le courtier voie clairement ce qu'il
// doit compléter ou retirer avant l'envoi plutôt que de les envoyer vides.
export function renderTemplate(text: string, vars: Partial<Record<string, string>>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = vars[key];
    return value !== undefined && value !== "" ? value : match;
  });
}
