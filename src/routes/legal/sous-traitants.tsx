import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout, type LegalBlock } from "@/components/legal/LegalPageLayout";

export const Route = createFileRoute("/legal/sous-traitants")({
  head: () => ({ meta: [{ title: "Registre des sous-traitants · SwissBroker Pro" }] }),
  component: SousTraitantsPage,
});

const blocks: LegalBlock[] = [
  { type: "h2", text: "Responsable" },
  { type: "p", text: "Piliarys Sàrl, Avenue des Roses 8, 1009 Pully, Suisse" },
  { type: "p", text: "IDE/UID : CHE-220.423.534" },
  { type: "p", text: "E-mail : contact@piliarys.ch" },

  { type: "h2", text: "1. Objet" },
  {
    type: "p",
    text: "Le présent registre identifie les principaux prestataires techniques utilisés ou susceptibles d'être utilisés dans le fonctionnement de SwissBroker Pro.",
  },

  { type: "h2", text: "2. Prestataires" },
  {
    type: "table",
    headers: ["Prestataire", "Fonction", "Données concernées", "Statut"],
    rows: [
      ["Vercel", "Hébergement et déploiement frontend", "données techniques, logs, données nécessaires au fonctionnement du service", "Sous-traitant technique"],
      ["Supabase", "Base de données et authentification", "données de comptes, dossiers clients, données saisies", "Sous-traitant technique"],
      ["Supabase Storage", "Stockage de fichiers", "documents et fichiers importés", "Sous-traitant technique"],
      ["Stripe", "Paiement et abonnements", "données de facturation et paiement", "Prestataire de paiement"],
      ["Anthropic / Claude API", "Intelligence artificielle", "données transmises dans le contexte des requêtes IA", "Fournisseur IA"],
      ["Brevo", "E-mails transactionnels", "nom, adresse e-mail et données nécessaires aux communications", "Prestataire e-mail"],
      ["Google Analytics", "Mesure d'audience", "données de navigation et données techniques selon configuration", "Fournisseur d'analyse"],
      ["Meta", "Mesure publicitaire", "données d'événements selon configuration", "Uniquement si activé"],
      ["LinkedIn", "Mesure publicitaire", "données d'événements selon configuration", "Uniquement si activé"],
    ],
  },

  { type: "h2", text: "3. Transferts internationaux" },
  { type: "p", text: "Certains prestataires peuvent traiter des données en dehors de la Suisse." },
  {
    type: "p",
    text: "Vercel indique notamment que ses principales installations de traitement sont situées aux États-Unis et prévoit des mécanismes contractuels pour les transferts depuis la Suisse.",
  },
  { type: "p", text: "Les autres fournisseurs peuvent également utiliser des infrastructures ou sous-traitants situés dans différents pays." },
  {
    type: "p",
    text: "Piliarys Sàrl vérifie les mécanismes de transfert applicables et met en œuvre les garanties appropriées lorsque celles-ci sont nécessaires.",
  },

  { type: "h2", text: "4. Sous-traitants ultérieurs" },
  { type: "p", text: "Les prestataires peuvent eux-mêmes recourir à des sous-traitants." },
  {
    type: "p",
    text: "Piliarys Sàrl tient compte des sous-traitants ultérieurs identifiés dans les documents contractuels et de sécurité de ses fournisseurs.",
  },

  { type: "h2", text: "5. Sécurité" },
  { type: "p", text: "La sélection des prestataires tient notamment compte :" },
  {
    type: "ul",
    items: [
      "de leurs mesures de sécurité ;",
      "de leurs engagements de confidentialité ;",
      "de leurs conditions de protection des données ;",
      "de leurs mécanismes de suppression ;",
      "de leurs mécanismes de transfert international ;",
      "de leurs certifications et garanties disponibles.",
    ],
  },

  { type: "h2", text: "6. Mise à jour" },
  {
    type: "p",
    text: "Le présent registre est actualisé lorsqu'un nouveau prestataire est ajouté ou qu'un prestataire existant est supprimé ou substantiellement modifié.",
  },
  { type: "p", text: "Contact : contact@piliarys.ch" },
];

function SousTraitantsPage() {
  return (
    <LegalPageLayout
      title="Registre des sous-traitants techniques – SwissBroker Pro"
      updated="27 août 2026"
      blocks={blocks}
    />
  );
}
