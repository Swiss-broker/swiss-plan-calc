import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout, type LegalBlock } from "@/components/legal/LegalPageLayout";

export const Route = createFileRoute("/legal/mentions-legales")({
  head: () => ({ meta: [{ title: "Mentions légales · SwissBroker Pro" }] }),
  component: MentionsLegalesPage,
});

const blocks: LegalBlock[] = [
  { type: "h2", text: "1. Éditeur" },
  {
    type: "p",
    text: "Le site internet swissbrokerpro.ch ainsi que la solution logicielle SaaS SwissBroker Pro sont édités et exploités par :",
  },
  { type: "p", text: "Piliarys Sàrl, Avenue des Roses 8, 1009 Pully, Suisse" },
  { type: "p", text: "IDE/UID : CHE-220.423.534" },
  { type: "p", text: "Représentant : Alexandre Boutin" },
  { type: "p", text: "E-mail : contact@piliarys.ch" },

  { type: "h2", text: "2. Activité" },
  {
    type: "p",
    text: "SwissBroker Pro est une solution logicielle SaaS destinée exclusivement aux professionnels du courtage.",
  },
  { type: "p", text: "La plateforme permet notamment aux courtiers de :" },
  {
    type: "ul",
    items: [
      "centraliser leurs dossiers clients ;",
      "saisir et gérer les informations nécessaires à leurs dossiers ;",
      "effectuer des simulations et calculs professionnels ;",
      "utiliser différents calculateurs liés notamment à la prévoyance ;",
      "préparer leurs rendez-vous clients ;",
      "utiliser des fonctionnalités d'assistance par intelligence artificielle ;",
      "générer des synthèses et comptes rendus.",
    ],
  },
  {
    type: "p",
    text: "SwissBroker Pro est un outil professionnel destiné au courtier et non une plateforme destinée aux clients finaux.",
  },

  { type: "h2", text: "3. Absence d'activité d'intermédiation directe" },
  {
    type: "p",
    text: "SwissBroker Pro ne commercialise pas directement de contrats d'assurance auprès des clients finaux.",
  },
  {
    type: "p",
    text: "La plateforme ne conclut pas de contrats d'assurance et ne fournit pas directement de conseil en assurance aux clients des courtiers.",
  },
  {
    type: "p",
    text: "Le courtier utilisateur demeure responsable de son activité professionnelle, de son analyse, de son conseil et des décisions prises à l'égard de ses propres clients.",
  },

  { type: "h2", text: "4. Accès au service" },
  {
    type: "p",
    text: "L'accès à SwissBroker Pro est réservé aux professionnels disposant d'un compte utilisateur et d'un abonnement valide.",
  },
  {
    type: "p",
    text: "Les clients finaux des courtiers n'ont pas vocation à créer ou utiliser directement un compte SwissBroker Pro.",
  },

  { type: "h2", text: "5. Propriété intellectuelle" },
  {
    type: "p",
    text: "L'ensemble des éléments du site et du service SwissBroker Pro, notamment les logiciels, interfaces, textes, contenus, logos, marques, éléments graphiques, bases de données, fonctionnalités et éléments techniques, est protégé par les dispositions applicables en matière de propriété intellectuelle.",
  },
  {
    type: "p",
    text: "Toute reproduction, représentation, modification, distribution ou exploitation non autorisée est interdite, sous réserve des exceptions prévues par la loi.",
  },

  { type: "h2", text: "6. Calculateurs et simulations" },
  {
    type: "p",
    text: "Les calculateurs et simulations proposés par SwissBroker Pro sont des outils professionnels d'aide à l'analyse.",
  },
  {
    type: "p",
    text: "Les résultats dépendent notamment des données saisies, des hypothèses, paramètres et règles intégrés au logiciel.",
  },
  { type: "p", text: "Ils sont fournis à titre indicatif et ne constituent pas une garantie de résultat." },
  {
    type: "p",
    text: "Le professionnel demeure responsable de la vérification et de l'interprétation des résultats avant toute utilisation dans le cadre d'un conseil.",
  },

  { type: "h2", text: "7. Intelligence artificielle" },
  {
    type: "p",
    text: "Certaines fonctionnalités de SwissBroker Pro utilisent des technologies d'intelligence artificielle.",
  },
  { type: "p", text: "Les réponses et contenus générés peuvent contenir des erreurs, omissions ou approximations." },
  { type: "p", text: "Ils doivent être vérifiés par l'utilisateur professionnel avant toute utilisation." },
  {
    type: "p",
    text: "L'intelligence artificielle ne remplace pas le jugement professionnel du courtier et ne prend aucune décision d'assurance à sa place.",
  },

  { type: "h2", text: "8. Données personnelles" },
  {
    type: "p",
    text: "Les traitements de données personnelles sont décrits dans la Politique de confidentialité de SwissBroker Pro.",
  },
  {
    type: "p",
    text: "Les données saisies par les courtiers dans leurs dossiers clients peuvent être traitées par Piliarys Sàrl ainsi que par les prestataires techniques nécessaires au fonctionnement du service.",
  },

  { type: "h2", text: "9. Prestataires techniques" },
  { type: "p", text: "SwissBroker Pro utilise notamment des prestataires pour :" },
  {
    type: "ul",
    items: [
      "l'hébergement et le déploiement ;",
      "la base de données et le stockage ;",
      "le paiement ;",
      "l'envoi d'e-mails ;",
      "l'intelligence artificielle ;",
      "la mesure d'audience ;",
      "et, lorsque ces outils sont activés, la mesure des campagnes publicitaires.",
    ],
  },
  {
    type: "p",
    text: "La liste des principaux prestataires est présentée dans le registre des sous-traitants techniques.",
  },

  { type: "h2", text: "10. Droit applicable" },
  {
    type: "p",
    text: "Les présentes mentions légales sont soumises au droit suisse, sous réserve des dispositions impératives applicables.",
  },

  { type: "h2", text: "11. Contact" },
  { type: "p", text: "Toute question relative à SwissBroker Pro ou au présent site peut être adressée à :" },
  { type: "p", text: "Piliarys Sàrl, Avenue des Roses 8, 1009 Pully, Suisse" },
  { type: "p", text: "contact@piliarys.ch" },
];

function MentionsLegalesPage() {
  return <LegalPageLayout title="Mentions légales – SwissBroker Pro" updated="27 août 2026" blocks={blocks} />;
}
