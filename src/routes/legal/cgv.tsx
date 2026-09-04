import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout, type LegalBlock } from "@/components/legal/LegalPageLayout";

export const Route = createFileRoute("/legal/cgv")({
  head: () => ({ meta: [{ title: "Conditions générales · SwissBroker Pro" }] }),
  component: CgvPage,
});

const blocks: LegalBlock[] = [
  { type: "h2", text: "1. Éditeur du service" },
  { type: "p", text: "SwissBroker Pro est édité et exploité par :" },
  { type: "p", text: "Piliarys Sàrl, Avenue des Roses 8, 1009 Pully, Suisse" },
  { type: "p", text: "IDE/UID : CHE-220.423.534" },
  { type: "p", text: "Représentant : Alexandre Boutin" },
  { type: "p", text: "E-mail : contact@piliarys.ch" },

  { type: "h2", text: "2. Objet" },
  {
    type: "p",
    text: "Les présentes conditions générales régissent l'accès et l'utilisation de SwissBroker Pro, solution logicielle SaaS destinée exclusivement aux professionnels du courtage.",
  },
  {
    type: "p",
    text: "SwissBroker Pro fournit notamment des fonctionnalités permettant au professionnel de centraliser des dossiers clients, effectuer des simulations, utiliser des calculateurs métier, préparer des rendez-vous et utiliser des fonctionnalités d'assistance par intelligence artificielle.",
  },
  { type: "p", text: "Le service n'est pas destiné directement aux clients finaux des courtiers." },

  { type: "h2", text: "3. Utilisateur professionnel" },
  { type: "p", text: "SwissBroker Pro est exclusivement destiné à des utilisateurs professionnels." },
  {
    type: "p",
    text: "La création d'un compte implique que l'utilisateur agit dans le cadre de son activité professionnelle et qu'il dispose des pouvoirs nécessaires pour engager l'organisation ou l'entreprise concernée lorsqu'il souscrit au service pour le compte de celle-ci.",
  },
  { type: "p", text: "L'utilisateur est responsable de l'exactitude des informations fournies lors de son inscription." },

  { type: "h2", text: "4. Création et sécurité du compte" },
  { type: "p", text: "L'accès au service nécessite un compte utilisateur." },
  { type: "p", text: "L'utilisateur est responsable :" },
  {
    type: "ul",
    items: [
      "de la confidentialité de ses identifiants ;",
      "de la sécurité de son mot de passe ;",
      "des personnes auxquelles il accorde un accès ;",
      "des opérations effectuées depuis son compte.",
    ],
  },
  {
    type: "p",
    text: "L'utilisateur doit informer Piliarys Sàrl dans les meilleurs délais en cas d'accès non autorisé ou de suspicion de compromission de son compte.",
  },

  { type: "h2", text: "5. Souscription" },
  { type: "p", text: "La souscription à un abonnement s'effectue en ligne selon les modalités proposées sur le site." },
  {
    type: "p",
    text: "Avant la conclusion du contrat, l'utilisateur peut consulter les conditions applicables, le prix de l'abonnement et les principales caractéristiques du service.",
  },
  { type: "p", text: "Le contrat est conclu lorsque la souscription est valablement confirmée et que le paiement est accepté." },
  { type: "p", text: "Les étapes techniques permettant la conclusion du contrat sont présentées dans le parcours de souscription." },

  { type: "h2", text: "6. Abonnements" },
  { type: "p", text: "Les abonnements SwissBroker Pro sont proposés selon les formules et fonctionnalités affichées au moment de la souscription." },
  { type: "p", text: "Les fonctionnalités disponibles peuvent varier selon le forfait choisi." },
  { type: "p", text: "Les limites propres à chaque forfait sont indiquées sur la page tarifaire correspondante." },

  { type: "h2", text: "7. Prix et modification des tarifs" },
  { type: "p", text: "Les prix applicables sont ceux affichés au moment de la souscription." },
  { type: "p", text: "Piliarys Sàrl peut modifier ses tarifs pour les nouvelles souscriptions." },
  { type: "p", text: "Une modification tarifaire ne modifie pas automatiquement le prix de l'abonnement déjà souscrit par un client." },
  {
    type: "p",
    text: "Lorsqu'un client dispose d'un abonnement à un tarif déterminé, ce tarif reste applicable pendant la durée de cet abonnement, sous réserve notamment d'une modification expressément acceptée par le client ou d'une nouvelle souscription à une autre formule.",
  },
  { type: "p", text: "Toute évolution applicable aux abonnements existants sera communiquée au client lorsque cela est nécessaire." },

  { type: "h2", text: "8. Paiement" },
  { type: "p", text: "Le paiement des abonnements est effectué par carte bancaire via Stripe." },
  {
    type: "p",
    text: "Piliarys Sàrl ne conserve pas directement les données complètes de carte bancaire lorsque celles-ci sont traitées par Stripe.",
  },
  { type: "p", text: "Le traitement des paiements est soumis aux conditions et politiques applicables de Stripe." },

  { type: "h2", text: "9. Renouvellement automatique" },
  { type: "p", text: "Les abonnements sont renouvelés automatiquement à chaque période de facturation." },
  { type: "p", text: "Le paiement correspondant est prélevé via le moyen de paiement enregistré auprès du prestataire de paiement." },

  { type: "h2", text: "10. Résiliation" },
  { type: "p", text: "L'abonnement est sans engagement de durée minimale." },
  { type: "p", text: "L'utilisateur peut demander la résiliation de son abonnement à tout moment." },
  { type: "p", text: "La résiliation prend effet à la fin de la période d'abonnement déjà payée." },
  {
    type: "p",
    text: "Exemple : lorsqu'un abonnement mensuel est souscrit le 2 du mois, une demande de résiliation effectuée le 15 entraîne la fin de l'abonnement à l'issue de la période courant jusqu'au 2 du mois suivant.",
  },
  {
    type: "p",
    text: "La résiliation n'entraîne pas le remboursement des périodes déjà commencées ou payées, sauf disposition légale impérative contraire ou décision commerciale contraire de Piliarys Sàrl.",
  },

  { type: "h2", text: "11. Défaut de paiement" },
  {
    type: "p",
    text: "En cas de défaut ou d'échec de paiement, Piliarys Sàrl peut suspendre l'accès au service après information de l'utilisateur et lui accorder, lorsque cela est approprié, un délai pour régulariser sa situation.",
  },
  { type: "p", text: "En cas de non-régularisation, Piliarys Sàrl peut suspendre ou résilier l'abonnement." },
  { type: "p", text: "La suspension pour défaut de paiement ne supprime pas les sommes déjà dues." },

  { type: "h2", text: "12. Accès au service" },
  {
    type: "p",
    text: "L'accès au service est fourni immédiatement après validation de la souscription et du paiement, sous réserve du bon fonctionnement des systèmes techniques nécessaires.",
  },
  { type: "p", text: "SwissBroker Pro est conçu pour être accessible 24 heures sur 24 et 7 jours sur 7." },
  { type: "p", text: "Toutefois, Piliarys Sàrl ne garantit pas une disponibilité ininterrompue ou exempte d'erreurs." },
  { type: "p", text: "Des interruptions peuvent notamment intervenir pour :" },
  {
    type: "ul",
    items: [
      "maintenance ;",
      "mises à jour ;",
      "corrections de sécurité ;",
      "évolution du service ;",
      "incidents techniques ;",
      "problèmes liés à des prestataires tiers ;",
      "événements indépendants de la volonté de Piliarys Sàrl.",
    ],
  },

  { type: "h2", text: "13. Maintenance et évolution" },
  { type: "p", text: "Piliarys Sàrl peut faire évoluer régulièrement SwissBroker Pro." },
  { type: "p", text: "Les fonctionnalités peuvent être améliorées, modifiées, remplacées ou supprimées lorsque cela est nécessaire à l'évolution du service." },
  { type: "p", text: "Piliarys Sàrl s'efforce de préserver la cohérence générale du service et les fonctionnalités essentielles souscrites par le client." },

  { type: "h2", text: "14. Limites du forfait" },
  { type: "p", text: "Les fonctionnalités et capacités accessibles à l'utilisateur dépendent du forfait souscrit." },
  { type: "p", text: "Certaines fonctionnalités, volumes, utilisateurs, calculateurs ou services peuvent être limités selon la formule choisie." },
  { type: "p", text: "L'utilisation du service au-delà des limites contractuelles peut nécessiter une modification de forfait." },

  { type: "h2", text: "15. Données du client" },
  { type: "p", text: "L'utilisateur conserve ses droits sur les données qu'il introduit dans SwissBroker Pro." },
  { type: "p", text: "L'utilisateur autorise Piliarys Sàrl à traiter ces données dans la mesure nécessaire à la fourniture du service." },
  {
    type: "p",
    text: "Lorsqu'il saisit les données de ses propres clients, l'utilisateur demeure responsable de disposer des droits et autorisations nécessaires à leur traitement.",
  },
  { type: "p", text: "L'utilisateur s'engage à ne pas introduire dans SwissBroker Pro des données qu'il n'est pas autorisé à traiter." },

  { type: "h2", text: "16. Confidentialité" },
  {
    type: "p",
    text: "Piliarys Sàrl s'engage à traiter les données confiées par ses clients conformément aux présentes conditions, à la politique de confidentialité et, lorsqu'il est applicable, à l'accord de traitement des données conclu avec le client.",
  },
  {
    type: "p",
    text: "Les informations confidentielles auxquelles Piliarys Sàrl a accès dans le cadre de ses prestations ne doivent pas être utilisées à des fins étrangères à l'exécution du service, sous réserve des obligations légales applicables.",
  },

  { type: "h2", text: "17. Calculateurs et simulations" },
  { type: "p", text: "Les calculateurs de SwissBroker Pro constituent des outils de simulation et d'aide au travail du professionnel." },
  { type: "p", text: "Les résultats peuvent dépendre :" },
  {
    type: "ul",
    items: [
      "des données saisies ;",
      "des hypothèses utilisées ;",
      "des paramètres applicables ;",
      "de la réglementation en vigueur ;",
      "des méthodes de calcul intégrées dans le logiciel ;",
      "de la date de mise à jour des paramètres.",
    ],
  },
  { type: "p", text: "Les résultats sont fournis à titre indicatif." },
  {
    type: "p",
    text: "Ils ne constituent pas une garantie de résultat et ne remplacent pas la vérification professionnelle nécessaire avant toute utilisation dans le cadre d'un conseil client.",
  },
  {
    type: "p",
    text: "Piliarys Sàrl ne garantit pas que les résultats d'une simulation correspondent à une décision, prestation, rente, imposition ou situation contractuelle effectivement applicable au client final.",
  },
  { type: "p", text: "Le professionnel demeure responsable de la vérification, de l'interprétation et de l'utilisation des résultats." },

  { type: "h2", text: "18. Intelligence artificielle" },
  { type: "p", text: "SwissBroker Pro propose des fonctionnalités utilisant l'intelligence artificielle." },
  { type: "p", text: "L'intelligence artificielle est fournie comme outil d'assistance au professionnel." },
  { type: "p", text: "Elle peut générer des erreurs, omissions, approximations ou informations incorrectes." },
  { type: "p", text: "L'utilisateur doit vérifier les résultats générés avant toute utilisation professionnelle ou communication à un client." },
  { type: "p", text: "L'intelligence artificielle :" },
  {
    type: "ul",
    items: [
      "ne fournit pas directement de contrat d'assurance ;",
      "ne conclut pas de contrat d'assurance ;",
      "ne prend pas de décision à la place du courtier ;",
      "ne remplace pas le jugement professionnel du courtier ;",
      "ne constitue pas un conseiller financier ou un courtier indépendant.",
    ],
  },

  { type: "h2", text: "19. Absence de fourniture directe de conseil en assurance" },
  { type: "p", text: "SwissBroker Pro est un outil logiciel destiné aux professionnels." },
  { type: "p", text: "Piliarys Sàrl fournit l'infrastructure et les fonctionnalités logicielles décrites dans le service." },
  {
    type: "p",
    text: "SwissBroker Pro ne fournit pas directement au client final du courtier une recommandation d'assurance et ne conclut pas de contrat d'assurance avec celui-ci.",
  },
  { type: "p", text: "Le courtier utilisateur demeure responsable de son activité professionnelle, de son conseil et des décisions prises à l'égard de ses propres clients." },

  { type: "h2", text: "20. Propriété intellectuelle" },
  {
    type: "p",
    text: "SwissBroker Pro, son logiciel, son interface, sa structure, ses éléments graphiques, ses textes, ses marques, ses bases de données, ses fonctionnalités et ses éléments techniques sont protégés par les droits applicables.",
  },
  { type: "p", text: "Aucune disposition des présentes conditions ne transfère au client la propriété du logiciel." },
  { type: "p", text: "Le client bénéficie uniquement d'un droit d'utilisation du service pendant la durée de son abonnement." },
  { type: "p", text: "Il est interdit notamment de :" },
  {
    type: "ul",
    items: [
      "copier le logiciel ;",
      "reproduire son interface de manière substantielle ;",
      "tenter d'accéder à son code source ;",
      "contourner les mesures de sécurité ;",
      "revendre ou sous-licencier le service ;",
      "utiliser le service pour développer un service concurrent en violation des droits applicables.",
    ],
  },

  { type: "h2", text: "21. Disponibilité et responsabilité" },
  { type: "p", text: "Piliarys Sàrl met en œuvre des efforts raisonnables pour assurer le bon fonctionnement de SwissBroker Pro." },
  {
    type: "p",
    text: "Toutefois, compte tenu de la nature d'un service SaaS, aucune disponibilité absolue ou absence totale d'erreur ne peut être garantie.",
  },
  { type: "p", text: "Piliarys Sàrl ne peut notamment être tenue responsable des conséquences résultant :" },
  {
    type: "ul",
    items: [
      "d'une erreur dans les données saisies par l'utilisateur ;",
      "d'une mauvaise interprétation d'un résultat ;",
      "d'une décision prise par le professionnel sur la seule base d'un résultat de simulation ou d'une réponse d'intelligence artificielle ;",
      "d'une indisponibilité d'un service tiers ;",
      "d'une défaillance du matériel ou de la connexion Internet de l'utilisateur ;",
      "d'un usage contraire aux présentes conditions.",
    ],
  },
  { type: "p", text: "Les limitations de responsabilité prévues par le présent article s'appliquent sous réserve des dispositions impératives du droit suisse." },

  { type: "h2", text: "22. Utilisation interdite" },
  { type: "p", text: "L'utilisateur s'engage à ne pas :" },
  {
    type: "ul",
    items: [
      "utiliser le service à des fins illégales ;",
      "tenter de compromettre la sécurité du service ;",
      "accéder aux données d'un autre utilisateur ;",
      "contourner les restrictions de son abonnement ;",
      "introduire volontairement des logiciels malveillants ;",
      "utiliser le service pour porter atteinte aux droits de tiers.",
    ],
  },

  { type: "h2", text: "23. Suspension pour raison de sécurité" },
  { type: "p", text: "Piliarys Sàrl peut suspendre temporairement un compte lorsqu'une telle mesure est raisonnablement nécessaire pour :" },
  {
    type: "ul",
    items: [
      "protéger le service ;",
      "protéger les données ;",
      "empêcher une utilisation frauduleuse ;",
      "répondre à un incident de sécurité ;",
      "empêcher une attaque ou une compromission.",
    ],
  },
  { type: "p", text: "Lorsque cela est possible, l'utilisateur est informé de la suspension et de ses motifs." },

  { type: "h2", text: "24. Protection des données" },
  { type: "p", text: "Les traitements de données personnelles sont régis par la politique de confidentialité de SwissBroker Pro." },
  {
    type: "p",
    text: "Lorsque le courtier traite les données de ses propres clients au moyen du service, les obligations respectives des parties sont précisées dans l'accord de traitement des données applicable.",
  },

  { type: "h2", text: "25. Modification des conditions" },
  {
    type: "p",
    text: "Piliarys Sàrl peut modifier les présentes conditions lorsque cela est nécessaire, notamment en raison de l'évolution du service, de la réglementation ou des pratiques commerciales.",
  },
  { type: "p", text: "Les nouvelles conditions sont publiées sur le site et, lorsque cela est nécessaire, communiquées aux clients concernés." },
  { type: "p", text: "Les modifications substantielles affectant les abonnements existants seront traitées conformément aux droits contractuels et légaux applicables." },

  { type: "h2", text: "26. Droit applicable" },
  { type: "p", text: "Les présentes conditions sont soumises au droit suisse." },
  {
    type: "p",
    text: "Sous réserve des règles impératives applicables, tout litige relatif au service ou aux présentes conditions relève des tribunaux compétents du siège de Piliarys Sàrl.",
  },

  { type: "h2", text: "27. Acceptation" },
  { type: "p", text: "En souscrivant à SwissBroker Pro, l'utilisateur reconnaît avoir pris connaissance des présentes conditions et les accepter." },
  { type: "p", text: "La case d'acceptation des conditions générales doit être activée avant la confirmation de la souscription." },
];

function CgvPage() {
  return (
    <LegalPageLayout
      title="Conditions générales de vente et d'utilisation – SwissBroker Pro"
      updated="27 août 2026"
      blocks={blocks}
    />
  );
}
