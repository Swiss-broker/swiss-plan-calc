import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout, type LegalBlock } from "@/components/legal/LegalPageLayout";

export const Route = createFileRoute("/legal/notice-ia")({
  head: () => ({ meta: [{ title: "Notice relative à l'IA · SwissBroker Pro" }] }),
  component: NoticeIaPage,
});

const blocks: LegalBlock[] = [
  { type: "h2", text: "1. Pourquoi une IA dans SwissBroker Pro ?" },
  {
    type: "p",
    text: "SwissBroker Pro intègre une intelligence artificielle afin d'assister les professionnels du courtage dans leur travail quotidien.",
  },
  { type: "p", text: "Elle est conçue comme un copilote professionnel, et non comme un conseiller autonome." },

  { type: "h2", text: "2. Fonctionnalités" },
  { type: "p", text: "L'IA peut notamment aider le courtier à :" },
  {
    type: "ul",
    items: [
      "synthétiser un dossier ;",
      "préparer un rendez-vous ;",
      "identifier les informations importantes d'un dossier ;",
      "générer un compte rendu ;",
      "répondre à des questions relatives au contexte du dossier ;",
      "faciliter l'exploitation des informations déjà saisies.",
    ],
  },

  { type: "h2", text: "3. IA contextuelle" },
  {
    type: "p",
    text: "Lorsque le courtier utilise l'assistant depuis un dossier client, certaines informations de ce dossier peuvent être utilisées comme contexte afin de générer une réponse pertinente.",
  },
  {
    type: "p",
    text: "L'objectif est notamment d'éviter au courtier de recopier manuellement des informations déjà présentes dans son dossier.",
  },

  { type: "h2", text: "4. L'IA ne conseille pas le client final" },
  { type: "p", text: "SwissBroker Pro ne fournit pas directement de conseil au client final." },
  { type: "p", text: "L'IA :" },
  {
    type: "ul",
    items: [
      "ne vend pas d'assurance ;",
      "ne propose pas de contrat d'assurance ;",
      "ne conclut pas de contrat ;",
      "ne choisit pas une assurance ;",
      "ne prend pas de décision professionnelle ;",
      "ne remplace pas le courtier.",
    ],
  },

  { type: "h2", text: "5. L'IA peut se tromper" },
  { type: "p", text: "Les résultats générés par l'intelligence artificielle peuvent être :" },
  { type: "ul", items: ["inexacts ;", "incomplets ;", "approximatifs ;", "mal interprétés ;", "ou inadaptés au contexte."] },
  {
    type: "p",
    text: "Le courtier doit donc toujours vérifier les informations générées avant de les utiliser professionnellement ou de les communiquer à un client.",
  },

  { type: "h2", text: "6. Fournisseur" },
  { type: "p", text: "SwissBroker Pro utilise actuellement Claude API d'Anthropic." },
  {
    type: "p",
    text: "Certaines informations nécessaires à une requête peuvent être transmises au fournisseur afin de générer la réponse demandée.",
  },
  {
    type: "p",
    text: "Les conditions contractuelles et de traitement applicables au service API utilisé sont prises en compte dans l'architecture de SwissBroker Pro.",
  },

  { type: "h2", text: "7. Données utilisées" },
  {
    type: "p",
    text: "Lorsque l'assistant est utilisé dans un dossier, les informations nécessaires à la requête peuvent être transmises au service d'intelligence artificielle.",
  },
  {
    type: "p",
    text: "SwissBroker Pro vise à limiter les données transmises à celles nécessaires au fonctionnement de la fonctionnalité utilisée.",
  },

  { type: "h2", text: "8. Utilisation des données pour l'entraînement" },
  {
    type: "p",
    text: "Piliarys Sàrl n'utilise pas volontairement les données des dossiers clients pour entraîner son propre modèle d'intelligence artificielle.",
  },
  {
    type: "p",
    text: "Les conditions du fournisseur IA applicable au service utilisé déterminent également les modalités de traitement des données transmises à ce fournisseur.",
  },

  { type: "h2", text: "9. Responsabilité" },
  { type: "p", text: "Le courtier demeure responsable :" },
  {
    type: "ul",
    items: [
      "des informations qu'il saisit ;",
      "de la vérification des résultats ;",
      "de son analyse ;",
      "de son conseil ;",
      "des décisions prises ;",
      "des informations communiquées à ses clients.",
    ],
  },
  { type: "p", text: "SwissBroker Pro constitue un outil d'assistance." },

  { type: "h2", text: "10. Évolution" },
  { type: "p", text: "Les modèles et fournisseurs d'intelligence artificielle peuvent évoluer." },
  {
    type: "p",
    text: "Piliarys Sàrl peut modifier le fournisseur ou le modèle utilisé lorsque cela est nécessaire pour améliorer la qualité, la sécurité ou les performances du service.",
  },
  {
    type: "p",
    text: "Toute évolution substantielle ayant une incidence sur le traitement des données personnelles sera prise en compte dans la documentation applicable.",
  },

  { type: "h2", text: "11. Contact" },
  { type: "p", text: "contact@piliarys.ch" },
];

function NoticeIaPage() {
  return (
    <LegalPageLayout
      title="Notice relative à l'utilisation de l'intelligence artificielle – SwissBroker Pro"
      updated="27 août 2026"
      blocks={blocks}
    />
  );
}
