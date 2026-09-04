import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout, type LegalBlock } from "@/components/legal/LegalPageLayout";

export const Route = createFileRoute("/legal/confidentialite")({
  head: () => ({ meta: [{ title: "Politique de confidentialité · SwissBroker Pro" }] }),
  component: ConfidentialitePage,
});

const blocks: LegalBlock[] = [
  { type: "h2", text: "1. Responsable du traitement" },
  { type: "p", text: "SwissBroker Pro est édité et exploité par :" },
  { type: "p", text: "Piliarys Sàrl, Avenue des Roses 8, 1009 Pully, Suisse" },
  { type: "p", text: "IDE/UID : CHE-220.423.534" },
  { type: "p", text: "Représentant : Alexandre Boutin" },
  { type: "p", text: "E-mail : contact@piliarys.ch" },
  { type: "p", text: "Piliarys Sàrl est responsable des traitements qu'elle réalise pour ses propres finalités." },
  {
    type: "p",
    text: "Pour les données introduites par un courtier concernant ses propres clients, le courtier est en principe responsable du traitement de ces données dans le cadre de son activité professionnelle et Piliarys Sàrl agit en qualité de prestataire technique et de sous-traitant.",
  },

  { type: "h2", text: "2. Fonctionnement de SwissBroker Pro" },
  { type: "p", text: "SwissBroker Pro est une solution SaaS B2B exclusivement destinée aux professionnels du courtage." },
  { type: "p", text: "Le client final du courtier n'utilise pas directement SwissBroker Pro." },
  {
    type: "p",
    text: "Le courtier utilise la plateforme pour gérer ses dossiers, effectuer des simulations, préparer ses rendez-vous et utiliser les fonctionnalités d'assistance proposées par le service.",
  },

  { type: "h2", text: "3. Données pouvant être traitées" },
  { type: "h3", text: "Données des utilisateurs professionnels" },
  { type: "p", text: "SwissBroker Pro peut traiter :" },
  {
    type: "ul",
    items: [
      "nom et prénom ;",
      "adresse e-mail ;",
      "coordonnées professionnelles ;",
      "informations relatives au compte ;",
      "données d'abonnement ;",
      "informations de facturation ;",
      "données de connexion ;",
      "informations techniques et de sécurité.",
    ],
  },
  { type: "h3", text: "Données des clients des courtiers" },
  { type: "p", text: "Les courtiers peuvent saisir dans SwissBroker Pro les informations nécessaires à leurs dossiers, notamment :" },
  {
    type: "ul",
    items: [
      "nom et prénom ;",
      "adresse ;",
      "date de naissance ;",
      "coordonnées ;",
      "situation familiale ;",
      "situation professionnelle ;",
      "revenus ;",
      "données relatives à la prévoyance ;",
      "données AVS et LPP ;",
      "informations fiscales ;",
      "informations relatives aux assurances ;",
      "données nécessaires aux simulations ;",
      "notes et observations ;",
      "documents importés ;",
      "résultats de simulations ;",
      "informations nécessaires à la préparation du rendez-vous.",
    ],
  },
  { type: "p", text: "Le courtier détermine les données qu'il saisit et demeure responsable de la légitimité de leur collecte et de leur utilisation." },

  { type: "h2", text: "4. Finalités" },
  { type: "p", text: "Les données sont traitées afin de :" },
  {
    type: "ul",
    items: [
      "créer et gérer les comptes ;",
      "fournir SwissBroker Pro ;",
      "stocker les dossiers ;",
      "effectuer les simulations ;",
      "alimenter les calculateurs ;",
      "préparer les rendez-vous ;",
      "générer des synthèses et comptes rendus ;",
      "fournir les fonctionnalités IA ;",
      "assurer la sécurité ;",
      "détecter les utilisations abusives ;",
      "assurer la maintenance ;",
      "fournir le support ;",
      "gérer les abonnements et paiements ;",
      "assurer la continuité du service ;",
      "respecter les obligations légales.",
    ],
  },

  { type: "h2", text: "5. Données traitées pour le compte du courtier" },
  {
    type: "p",
    text: "Lorsqu'un courtier introduit les données d'un client dans SwissBroker Pro, Piliarys Sàrl traite ces données uniquement dans la mesure nécessaire à la fourniture du service et conformément aux instructions applicables du courtier.",
  },
  { type: "p", text: "Le courtier demeure responsable :" },
  {
    type: "ul",
    items: [
      "de la collecte des données ;",
      "de l'information de ses clients ;",
      "de la légitimité du traitement ;",
      "de l'exactitude des informations introduites ;",
      "de la détermination des finalités.",
    ],
  },

  { type: "h2", text: "6. Accès aux données" },
  { type: "p", text: "Les données sont accessibles uniquement aux personnes et systèmes autorisés nécessaires au fonctionnement du service." },
  { type: "p", text: "Peuvent notamment y accéder :" },
  {
    type: "ul",
    items: [
      "le courtier ayant créé ou auquel est attribué le dossier ;",
      "les utilisateurs autorisés de son organisation ;",
      "Piliarys Sàrl lorsque cet accès est nécessaire à la fourniture, à la maintenance, à la sécurité ou au support ;",
      "les prestataires techniques intervenant pour le fonctionnement du service.",
    ],
  },
  { type: "p", text: "Un courtier ne doit pas pouvoir accéder aux données appartenant à un autre courtier ou à une autre organisation." },

  { type: "h2", text: "7. Prestataires techniques" },
  { type: "p", text: "SwissBroker Pro utilise les prestataires suivants :" },
  {
    type: "ul",
    items: [
      "Vercel : hébergement, déploiement et infrastructure technique.",
      "Supabase : base de données, authentification et stockage des fichiers via Supabase Storage.",
      "Stripe : paiement et gestion des abonnements.",
      "Anthropic / Claude API : fonctionnalités d'intelligence artificielle.",
      "Brevo : envoi d'e-mails.",
      "Google Analytics : mesure d'audience, lorsqu'activé.",
      "Meta : mesure publicitaire et marketing, uniquement si les outils correspondants sont activés.",
      "LinkedIn : mesure publicitaire et marketing, uniquement si les outils correspondants sont activés.",
    ],
  },

  { type: "h2", text: "8. Transferts internationaux" },
  { type: "p", text: "Certains prestataires utilisés par SwissBroker Pro peuvent traiter des données personnelles en dehors de la Suisse." },
  {
    type: "p",
    text: "Par exemple, Vercel indique que ses principales infrastructures de traitement sont situées aux États-Unis et prévoit des mécanismes spécifiques pour les transferts de données depuis la Suisse.",
  },
  { type: "p", text: "Les autres prestataires peuvent également recourir à des infrastructures ou sous-traitants situés dans différents pays." },
  {
    type: "p",
    text: "Piliarys Sàrl vérifie les mécanismes de transfert applicables à chaque prestataire et met en œuvre les garanties nécessaires conformément au droit suisse applicable.",
  },
  { type: "p", text: "Les principaux prestataires et leurs fonctions sont présentés dans le registre des sous-traitants techniques." },

  { type: "h2", text: "9. Intelligence artificielle" },
  {
    type: "p",
    text: "SwissBroker Pro utilise actuellement des fonctionnalités d'intelligence artificielle reposant notamment sur Claude API fourni par Anthropic.",
  },
  {
    type: "p",
    text: "Lorsque le courtier utilise une fonctionnalité IA, certaines données nécessaires à la génération de la réponse peuvent être transmises au fournisseur d'intelligence artificielle.",
  },
  { type: "p", text: "Les fonctionnalités IA sont destinées à assister le professionnel." },
  { type: "p", text: "L'IA peut notamment :" },
  {
    type: "ul",
    items: [
      "synthétiser un dossier ;",
      "préparer un rendez-vous ;",
      "générer un compte rendu ;",
      "aider à analyser les informations disponibles ;",
      "répondre à des questions relatives au contexte autorisé du dossier.",
    ],
  },
  { type: "p", text: "Les résultats générés par l'IA peuvent contenir des erreurs et doivent être vérifiés par le professionnel." },
  { type: "p", text: "Piliarys Sàrl n'utilise pas volontairement les données des dossiers clients pour entraîner son propre modèle d'intelligence artificielle." },

  { type: "h2", text: "10. Paiements" },
  { type: "p", text: "Les paiements sont réalisés via Stripe." },
  { type: "p", text: "Les données complètes de carte bancaire sont traitées par Stripe conformément à ses propres conditions et politiques de sécurité." },
  { type: "p", text: "Piliarys Sàrl ne conserve pas volontairement les données complètes de carte bancaire dans ses propres bases de données." },

  { type: "h2", text: "11. Mesure d'audience et marketing" },
  { type: "p", text: "SwissBroker Pro peut utiliser Google Analytics pour mesurer l'audience du site." },
  { type: "p", text: "Des outils de Meta et LinkedIn peuvent également être activés ultérieurement pour mesurer les performances de campagnes publicitaires." },
  { type: "p", text: "Ces outils non nécessaires au fonctionnement du site sont activés conformément aux choix de consentement applicables." },

  { type: "h2", text: "12. Sécurité" },
  { type: "p", text: "Piliarys Sàrl met en œuvre des mesures techniques et organisationnelles destinées à protéger les données contre :" },
  { type: "ul", items: ["les accès non autorisés ;", "la perte ;", "la destruction ;", "l'altération ;", "la divulgation ;", "l'utilisation abusive."] },
  {
    type: "p",
    text: "Ces mesures comprennent notamment la gestion des accès, l'authentification, la protection des infrastructures, la gestion des secrets, la sauvegarde, la journalisation et la surveillance des incidents, selon les fonctionnalités effectivement disponibles dans l'architecture du service.",
  },

  { type: "h2", text: "13. Durée de conservation" },
  { type: "h3", text: "Données du compte professionnel" },
  { type: "p", text: "Les données du compte sont conservées pendant toute la durée de la relation contractuelle." },
  {
    type: "p",
    text: "Après suppression du compte, les données actives sont supprimées dans un délai maximal de 30 jours, sauf obligation légale, nécessité de conservation pour la défense des droits ou autre motif légitime.",
  },
  { type: "h3", text: "Dossiers clients" },
  { type: "p", text: "Les données des dossiers clients sont conservées pendant la durée d'utilisation du service." },
  { type: "p", text: "Après suppression d'un dossier ou du compte, les données actives sont supprimées dans un délai maximal de 30 jours, sauf obligation légale ou nécessité légitime de conservation." },
  { type: "h3", text: "Sauvegardes" },
  { type: "p", text: "Les données peuvent demeurer temporairement présentes dans des sauvegardes techniques." },
  {
    type: "p",
    text: "Les sauvegardes sont destinées à la continuité et à la sécurité du service et sont supprimées ou écrasées dans un délai maximal cible de 90 jours, sous réserve des contraintes techniques des prestataires et des obligations légales.",
  },
  { type: "h3", text: "Données de facturation" },
  { type: "p", text: "Les informations nécessaires à la facturation, à la comptabilité et à la fiscalité sont conservées pendant la durée requise par les obligations légales applicables." },
  { type: "p", text: "Certaines pièces comptables peuvent notamment devoir être conservées pendant 10 ans." },
  { type: "h3", text: "Journaux de sécurité" },
  {
    type: "p",
    text: "Les journaux techniques et de sécurité sont conservés pendant une durée maximale cible de 12 mois, sauf lorsqu'une conservation plus longue est nécessaire pour traiter un incident, respecter une obligation légale ou défendre les droits de Piliarys Sàrl.",
  },

  { type: "h2", text: "14. Droits des personnes" },
  { type: "p", text: "Selon la législation applicable, les personnes concernées peuvent notamment demander :" },
  {
    type: "ul",
    items: [
      "l'accès à leurs données ;",
      "la rectification de données incorrectes ;",
      "la suppression de données lorsque les conditions légales sont réunies ;",
      "la limitation ou l'opposition à certains traitements lorsque ces droits sont applicables ;",
      "la portabilité des données lorsque les conditions légales sont réunies.",
    ],
  },
  {
    type: "p",
    text: "Lorsqu'une personne demande l'accès ou la suppression de données saisies par un courtier dans le cadre de son dossier client, elle doit en principe s'adresser au courtier concerné, qui est responsable du traitement.",
  },
  { type: "p", text: "Une demande peut également être adressée à Piliarys Sàrl :" },
  { type: "p", text: "contact@piliarys.ch" },

  { type: "h2", text: "15. Violation de données" },
  { type: "p", text: "En cas de violation de la sécurité susceptible d'affecter des données personnelles, Piliarys Sàrl prend les mesures nécessaires pour :" },
  {
    type: "ul",
    items: [
      "identifier l'incident ;",
      "limiter ses conséquences ;",
      "sécuriser les systèmes ;",
      "analyser les données concernées ;",
      "documenter l'incident ;",
      "déterminer les obligations de notification.",
    ],
  },
  {
    type: "p",
    text: "Lorsqu'un incident concerne les données traitées pour le compte d'un courtier, Piliarys Sàrl l'informe dans les meilleurs délais raisonnables lorsque cela est nécessaire.",
  },

  { type: "h2", text: "16. Cookies" },
  { type: "p", text: "L'utilisation des cookies et technologies similaires est détaillée dans la Politique relative aux cookies et technologies similaires." },

  { type: "h2", text: "17. Modifications" },
  { type: "p", text: "La présente politique peut être modifiée pour tenir compte de l'évolution du service, des prestataires, des technologies ou de la réglementation." },
  { type: "p", text: "La version publiée sur le site constitue la version applicable." },

  { type: "h2", text: "18. Droit applicable" },
  { type: "p", text: "La présente politique est soumise au droit suisse, sous réserve des dispositions impératives applicables." },

  { type: "h2", text: "19. Contact" },
  { type: "p", text: "Piliarys Sàrl, Avenue des Roses 8, 1009 Pully, Suisse" },
  { type: "p", text: "contact@piliarys.ch" },
];

function ConfidentialitePage() {
  return <LegalPageLayout title="Politique de confidentialité – SwissBroker Pro" updated="27 août 2026" blocks={blocks} />;
}
