import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout, type LegalBlock } from "@/components/legal/LegalPageLayout";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({ meta: [{ title: "Politique de cookies · SwissBroker Pro" }] }),
  component: CookiesPage,
});

const blocks: LegalBlock[] = [
  { type: "h2", text: "1. Objet" },
  {
    type: "p",
    text: "La présente politique explique comment SwissBroker Pro utilise des cookies et technologies similaires sur son site internet.",
  },
  { type: "p", text: "SwissBroker Pro peut utiliser ces technologies pour :" },
  {
    type: "ul",
    items: [
      "assurer le fonctionnement du site ;",
      "sécuriser les sessions ;",
      "mesurer l'audience ;",
      "comprendre l'utilisation du site ;",
      "mesurer les performances des campagnes marketing ;",
      "améliorer l'expérience utilisateur.",
    ],
  },

  { type: "h2", text: "2. Cookies nécessaires" },
  { type: "p", text: "Certains cookies sont strictement nécessaires au fonctionnement du site ou du service." },
  { type: "p", text: "Ils peuvent notamment servir à :" },
  {
    type: "ul",
    items: [
      "maintenir une session ;",
      "authentifier un utilisateur ;",
      "sécuriser le service ;",
      "mémoriser des paramètres essentiels ;",
      "assurer le fonctionnement technique de la plateforme.",
    ],
  },
  { type: "p", text: "Ces cookies peuvent être utilisés sans consentement lorsqu'ils sont strictement nécessaires au service." },

  { type: "h2", text: "3. Google Analytics" },
  { type: "p", text: "SwissBroker Pro peut utiliser Google Analytics afin de mesurer l'audience du site." },
  { type: "p", text: "Les informations susceptibles d'être collectées comprennent notamment :" },
  {
    type: "ul",
    items: [
      "pages consultées ;",
      "interactions ;",
      "durée de consultation ;",
      "informations techniques ;",
      "informations relatives à la navigation ;",
      "source de provenance du visiteur.",
    ],
  },
  {
    type: "p",
    text: "Les fonctionnalités Analytics non nécessaires au fonctionnement du site sont configurées de manière à respecter les choix de consentement applicables.",
  },

  { type: "h2", text: "4. Meta Pixel" },
  {
    type: "p",
    text: "SwissBroker Pro peut utiliser le Meta Pixel ou des technologies similaires proposées par Meta afin de :",
  },
  {
    type: "ul",
    items: [
      "mesurer les conversions ;",
      "mesurer l'efficacité des campagnes ;",
      "comprendre les interactions avec le site ;",
      "créer des audiences publicitaires lorsque cela est autorisé.",
    ],
  },
  { type: "p", text: "Le Meta Pixel n'est activé que lorsque les conditions de consentement applicables sont remplies." },

  { type: "h2", text: "5. LinkedIn Insight Tag" },
  { type: "p", text: "SwissBroker Pro peut utiliser LinkedIn Insight Tag afin de :" },
  {
    type: "ul",
    items: [
      "mesurer les performances des campagnes LinkedIn ;",
      "mesurer certaines conversions ;",
      "comprendre les interactions avec le site ;",
      "établir des statistiques relatives aux campagnes.",
    ],
  },
  { type: "p", text: "Le tag n'est activé que lorsque les conditions de consentement applicables sont remplies." },

  { type: "h2", text: "6. Gestion du consentement" },
  {
    type: "p",
    text: "Lorsque cela est nécessaire, les cookies et technologies non essentiels sont soumis au choix de l'utilisateur.",
  },
  { type: "p", text: "Le bandeau de consentement permet notamment de :" },
  { type: "ul", items: ["Accepter tous les cookies", "Refuser les cookies non essentiels", "Personnaliser les préférences"] },
  {
    type: "p",
    text: "Le choix de l'utilisateur est enregistré afin d'éviter de lui redemander son consentement de manière excessive.",
  },

  { type: "h2", text: "7. Catégories" },
  { type: "p", text: "Les technologies utilisées peuvent être classées en quatre catégories :" },
  { type: "h3", text: "Nécessaires" },
  { type: "p", text: "Fonctionnement et sécurité du site." },
  { type: "h3", text: "Mesure d'audience" },
  { type: "p", text: "Google Analytics." },
  { type: "h3", text: "Marketing" },
  { type: "p", text: "Meta et LinkedIn lorsqu'ils sont activés." },
  { type: "h3", text: "Préférences" },
  { type: "p", text: "Mémorisation de certains choix utilisateur lorsqu'elle est utilisée." },

  { type: "h2", text: "8. Cookies de tiers" },
  {
    type: "p",
    text: "Les fournisseurs tiers peuvent traiter certaines données conformément à leurs propres politiques de confidentialité.",
  },
  { type: "p", text: "Les principaux fournisseurs susceptibles d'être utilisés sont :" },
  { type: "ul", items: ["Google ;", "Meta ;", "LinkedIn."] },

  { type: "h2", text: "9. Modification des préférences" },
  {
    type: "p",
    text: "Lorsque le site propose un outil de gestion des cookies, l'utilisateur peut modifier ses préférences à tout moment via le lien ou le bouton prévu à cet effet.",
  },

  { type: "h2", text: "10. Évolution" },
  { type: "p", text: "De nouveaux outils peuvent être ajoutés au site." },
  {
    type: "p",
    text: "Lorsqu'un nouvel outil implique un traitement de données personnelles ou un suivi non nécessaire, la présente politique est mise à jour et le mécanisme de consentement est adapté lorsque nécessaire.",
  },

  { type: "h2", text: "11. Contact" },
  { type: "p", text: "Pour toute question :" },
  { type: "p", text: "Piliarys Sàrl, Avenue des Roses 8, 1009 Pully, Suisse" },
  { type: "p", text: "contact@piliarys.ch" },
];

function CookiesPage() {
  return (
    <LegalPageLayout
      title="Politique relative aux cookies et technologies similaires"
      updated="27 août 2026"
      blocks={blocks}
    />
  );
}
