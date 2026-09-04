import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout, type LegalBlock } from "@/components/legal/LegalPageLayout";

export const Route = createFileRoute("/legal/dpa")({
  head: () => ({ meta: [{ title: "Accord de traitement des données · SwissBroker Pro" }] }),
  component: DpaPage,
});

const blocks: LegalBlock[] = [
  { type: "h2", text: "1. Objet" },
  {
    type: "p",
    text: "Le présent accord définit les conditions dans lesquelles Piliarys Sàrl, exploitant SwissBroker Pro, traite des données personnelles pour le compte d'un client professionnel utilisant le service.",
  },
  {
    type: "p",
    text: "Il complète les Conditions générales de vente et d'utilisation ainsi que la Politique de confidentialité de SwissBroker Pro.",
  },

  { type: "h2", text: "2. Parties" },
  { type: "h3", text: "Sous-traitant" },
  { type: "p", text: "Piliarys Sàrl, Avenue des Roses 8, 1009 Pully, Suisse" },
  { type: "p", text: "IDE/UID : CHE-220.423.534" },
  { type: "p", text: "Représentant : Alexandre Boutin" },
  { type: "p", text: "E-mail : contact@piliarys.ch" },
  { type: "h3", text: "Responsable du traitement" },
  {
    type: "p",
    text: "Le client professionnel ayant souscrit SwissBroker Pro, identifié dans son compte ou son contrat d'abonnement.",
  },
  {
    type: "p",
    text: "Le client détermine les finalités et les moyens du traitement des données de ses propres clients dans le cadre de son activité professionnelle.",
  },

  { type: "h2", text: "3. Objet du traitement" },
  { type: "p", text: "Le traitement est nécessaire à la fourniture de SwissBroker Pro." },
  { type: "p", text: "Il peut notamment permettre :" },
  {
    type: "ul",
    items: [
      "la création de dossiers clients ;",
      "le stockage des données ;",
      "l'utilisation des calculateurs ;",
      "la réalisation de simulations ;",
      "la préparation des rendez-vous ;",
      "la génération de synthèses ;",
      "la génération de comptes rendus ;",
      "l'utilisation des fonctionnalités d'assistance par intelligence artificielle ;",
      "la maintenance et le support du service ;",
      "la sécurité et la prévention des abus.",
    ],
  },

  { type: "h2", text: "4. Catégories de personnes concernées" },
  { type: "p", text: "Les données peuvent concerner notamment :" },
  {
    type: "ul",
    items: [
      "les clients finaux du courtier ;",
      "les prospects du courtier ;",
      "les personnes liées à un dossier client ;",
      "les représentants ou collaborateurs du client professionnel ;",
      "les utilisateurs autorisés du compte SwissBroker Pro.",
    ],
  },

  { type: "h2", text: "5. Catégories de données" },
  { type: "p", text: "Selon l'utilisation du service, les données peuvent comprendre :" },
  {
    type: "ul",
    items: [
      "données d'identification ;",
      "coordonnées ;",
      "données relatives à la situation familiale ;",
      "données professionnelles ;",
      "données de revenus ;",
      "données relatives à la prévoyance ;",
      "données AVS et LPP ;",
      "données fiscales ;",
      "données relatives aux assurances ;",
      "données nécessaires aux simulations ;",
      "notes et observations du courtier ;",
      "documents importés ;",
      "données générées par l'utilisation du service ;",
      "données techniques et de connexion.",
    ],
  },
  {
    type: "p",
    text: "Le client s'engage à ne transmettre que les données nécessaires et pertinentes à son activité et à l'utilisation du service.",
  },

  { type: "h2", text: "6. Données particulièrement sensibles" },
  {
    type: "p",
    text: "Le client doit éviter de transmettre des données personnelles qui ne sont pas nécessaires aux fonctionnalités du service.",
  },
  {
    type: "p",
    text: "Lorsque des données sensibles sont introduites dans SwissBroker Pro, le client doit s'assurer qu'il dispose d'une base légale appropriée et que leur traitement est compatible avec son activité et ses obligations professionnelles.",
  },
  { type: "p", text: "Piliarys Sàrl applique des mesures de sécurité adaptées aux données traitées." },

  { type: "h2", text: "7. Instructions" },
  {
    type: "p",
    text: "Piliarys Sàrl traite les données personnelles uniquement dans la mesure nécessaire à l'exécution du service et conformément :",
  },
  {
    type: "ul",
    items: [
      "aux instructions documentées du client ;",
      "aux présentes conditions ;",
      "aux Conditions générales ;",
      "à la Politique de confidentialité ;",
      "aux obligations légales applicables.",
    ],
  },
  {
    type: "p",
    text: "Piliarys Sàrl ne traite pas les données des clients du courtier pour ses propres finalités incompatibles avec le service.",
  },

  { type: "h2", text: "8. Confidentialité" },
  {
    type: "p",
    text: "Les personnes autorisées à traiter les données personnelles sont soumises à des obligations de confidentialité appropriées.",
  },
  { type: "p", text: "Les accès sont limités aux personnes et services qui en ont besoin pour l'exécution de leurs fonctions." },

  { type: "h2", text: "9. Sécurité" },
  {
    type: "p",
    text: "Piliarys Sàrl met en œuvre des mesures techniques et organisationnelles appropriées compte tenu de la nature des données et des risques associés.",
  },
  { type: "p", text: "Ces mesures peuvent notamment comprendre :" },
  {
    type: "ul",
    items: [
      "contrôle des accès ;",
      "authentification ;",
      "gestion des autorisations ;",
      "chiffrement lorsque techniquement approprié ;",
      "protection des infrastructures ;",
      "sauvegardes ;",
      "journalisation ;",
      "surveillance des incidents ;",
      "procédures de gestion des incidents ;",
      "limitation des accès administratifs.",
    ],
  },
  { type: "p", text: "Les mesures sont susceptibles d'évoluer avec le service." },

  { type: "h2", text: "10. Sous-traitants ultérieurs" },
  { type: "p", text: "Le client autorise Piliarys Sàrl à recourir à des prestataires techniques nécessaires à l'exploitation de SwissBroker Pro." },
  { type: "p", text: "Ces prestataires peuvent notamment intervenir pour :" },
  {
    type: "ul",
    items: [
      "l'hébergement ;",
      "le stockage ;",
      "la base de données ;",
      "l'envoi d'e-mails ;",
      "le paiement ;",
      "la sécurité ;",
      "l'intelligence artificielle ;",
      "la maintenance ;",
      "le support technique.",
    ],
  },
  {
    type: "p",
    text: "Piliarys Sàrl veille à sélectionner des prestataires présentant des garanties appropriées et encadre leur intervention conformément aux exigences applicables.",
  },
  { type: "p", text: "La liste des principaux sous-traitants utilisés par SwissBroker Pro est tenue à jour." },

  { type: "h2", text: "11. Intelligence artificielle" },
  {
    type: "p",
    text: "Lorsque le service utilise un fournisseur d'intelligence artificielle, certaines données peuvent être transmises à ce fournisseur afin de produire la fonctionnalité demandée par l'utilisateur.",
  },
  {
    type: "p",
    text: "Le fournisseur concerné est sélectionné et configuré conformément aux exigences de sécurité et de protection des données applicables.",
  },
  { type: "p", text: "Piliarys Sàrl doit notamment déterminer, pour chaque fournisseur :" },
  {
    type: "ul",
    items: [
      "les données effectivement transmises ;",
      "la finalité du traitement ;",
      "la durée de conservation ;",
      "les éventuels transferts internationaux ;",
      "les garanties contractuelles ;",
      "les possibilités de réutilisation des données par le fournisseur.",
    ],
  },
  {
    type: "p",
    text: "Les données ne doivent pas être utilisées par Piliarys Sàrl pour entraîner ou développer un modèle d'intelligence artificielle à des fins propres, sauf base contractuelle ou légale distincte.",
  },

  { type: "h2", text: "12. Transferts internationaux" },
  {
    type: "p",
    text: "Lorsqu'un sous-traitant ou fournisseur traite des données hors de Suisse, Piliarys Sàrl vérifie les conditions applicables aux transferts internationaux.",
  },
  {
    type: "p",
    text: "Lorsque nécessaire, les garanties appropriées sont mises en place conformément à la législation suisse applicable.",
  },
  {
    type: "p",
    text: "Les informations relatives aux principaux pays ou zones de traitement peuvent être communiquées au client dans la documentation relative aux sous-traitants.",
  },

  { type: "h2", text: "13. Assistance aux personnes concernées" },
  { type: "p", text: "Le client demeure responsable de répondre aux demandes de ses propres clients concernant leurs données personnelles." },
  {
    type: "p",
    text: "Lorsque Piliarys Sàrl reçoit directement une demande relative à des données traitées pour le compte du client, elle informe le client et lui apporte, dans la mesure raisonnable, l'assistance nécessaire.",
  },
  { type: "p", text: "Cette assistance peut notamment concerner :" },
  { type: "ul", items: ["recherche de données ;", "accès ;", "rectification ;", "suppression ;", "export ;", "restriction d'accès."] },

  { type: "h2", text: "14. Violation de la sécurité" },
  {
    type: "p",
    text: "Piliarys Sàrl informe le client dans les meilleurs délais raisonnables lorsqu'elle constate une violation de la sécurité des données personnelles traitées pour son compte et susceptible de présenter un risque pour les personnes concernées.",
  },
  { type: "p", text: "L'information peut notamment préciser :" },
  {
    type: "ul",
    items: [
      "la nature de l'incident ;",
      "les données potentiellement concernées ;",
      "les mesures prises ;",
      "les conséquences connues ;",
      "les mesures recommandées.",
    ],
  },
  {
    type: "p",
    text: "Piliarys Sàrl coopère raisonnablement avec le client afin de permettre à celui-ci de remplir ses obligations légales.",
  },
  {
    type: "p",
    text: "Le PFPDT prévoit notamment des obligations d'annonce lorsqu'une violation présente vraisemblablement un risque élevé pour la personnalité ou les droits fondamentaux.",
  },

  { type: "h2", text: "15. Suppression et restitution" },
  {
    type: "p",
    text: "À la fin du contrat, Piliarys Sàrl supprime ou restitue les données personnelles traitées pour le compte du client selon les modalités convenues.",
  },
  {
    type: "p",
    text: "Les données peuvent être temporairement conservées dans les sauvegardes techniques pendant une période limitée nécessaire à leur suppression complète.",
  },
  { type: "p", text: "Les données dont la conservation est imposée par une obligation légale peuvent être conservées pendant la durée correspondante." },

  { type: "h2", text: "16. Audit et informations" },
  {
    type: "p",
    text: "Piliarys Sàrl met à disposition du client les informations raisonnablement nécessaires pour démontrer le respect de ses obligations de sous-traitant.",
  },
  {
    type: "p",
    text: "Lorsque cela est nécessaire et proportionné, Piliarys Sàrl peut fournir des informations relatives à ses mesures de sécurité, ses sous-traitants et ses procédures de protection des données.",
  },
  { type: "p", text: "Les demandes d'audit ne doivent pas compromettre la sécurité ou la confidentialité des autres clients de SwissBroker Pro." },

  { type: "h2", text: "17. Responsabilités du client" },
  { type: "p", text: "Le client demeure responsable :" },
  {
    type: "ul",
    items: [
      "de la légalité de la collecte des données ;",
      "de l'information de ses propres clients ;",
      "de la détermination des finalités du traitement ;",
      "de la pertinence des données introduites ;",
      "des autorisations nécessaires ;",
      "du respect de ses obligations professionnelles ;",
      "de la vérification des résultats des calculateurs ;",
      "de la vérification des contenus générés par l'IA.",
    ],
  },

  { type: "h2", text: "18. Durée" },
  {
    type: "p",
    text: "Le présent accord s'applique pendant toute la durée d'utilisation de SwissBroker Pro par le client et aussi longtemps que Piliarys Sàrl traite des données personnelles pour son compte.",
  },

  { type: "h2", text: "19. Ordre de priorité" },
  {
    type: "p",
    text: "En cas de contradiction entre le présent accord et les Conditions générales concernant spécifiquement le traitement des données personnelles, le présent accord prévaut pour les questions relatives à la protection des données.",
  },

  { type: "h2", text: "20. Droit applicable" },
  { type: "p", text: "Le présent accord est soumis au droit suisse." },
  { type: "p", text: "Les dispositions impératives applicables en matière de protection des données demeurent réservées." },
];

function DpaPage() {
  return (
    <LegalPageLayout
      title="Accord de traitement des données (DPA) – SwissBroker Pro / Piliarys Sàrl"
      updated="27 août 2026"
      blocks={blocks}
    />
  );
}
