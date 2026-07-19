// Articles wiki · multilingue. FR = source de vérité, DE = traduction officielle.
// Pour ajouter une langue : dupliquer FR et traduire titles + body.

import type { ReactNode } from "react";
import type { AppLanguage } from "@/lib/i18n/types";

export type WikiArticle = {
  id: string;
  category: string;
  title: string;
  tags: string[];
  body: ReactNode;
};

// =====================================================================
// FR · source de vérité
// =====================================================================
const FR: WikiArticle[] = [
  {
    id: "demarrage",
    category: "Prise en main",
    title: "Premiers pas dans SwissBroker Pro",
    tags: ["intro", "courtier", "client"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Créer un client</strong> : menu Clients → Nouveau client. Renseigner identité, canton, situation civile, salaire.</li>
        <li><strong>Lancer un calcul</strong> : depuis la fiche client, choisir un calculateur dans la barre latérale (préremplissage automatique).</li>
        <li><strong>Sauvegarder</strong> : bouton « Sauvegarder » en bas de chaque calculateur. Retrouvable dans Historique.</li>
        <li><strong>Exporter</strong> : bouton PDF pour générer un rapport client prêt à envoyer.</li>
        <li><strong>Mode guide</strong> : bouton en haut à droite de chaque calculateur. Visite interactive des champs.</li>
      </ul>
    ),
  },
  {
    id: "wiki-clients",
    category: "Prise en main",
    title: "Fiche client : que renseigner ?",
    tags: ["client", "données"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Canton + commune</strong> : indispensable pour les multiplicateurs communaux et le barème ICC.</li>
        <li><strong>Situation civile + confession</strong> : impacte le barème (marié = splitting partiel) et l'impôt ecclésiastique.</li>
        <li><strong>Permis</strong> : permis B / G déclenchent l'imposition à la source.</li>
        <li><strong>Prévoyance</strong> : avoirs LPP, plafond rachat, comptes 3a/3b. Sert pour LPP, libre passage, retraite.</li>
        <li><strong>Patrimoine</strong> : immobilier, titres, comptes. Sert pour l'impôt sur la fortune et la valeur locative.</li>
      </ul>
    ),
  },
  {
    id: "avs-base",
    category: "1er pilier · AVS / AI",
    title: "Comment fonctionne la rente AVS",
    tags: ["AVS", "AI", "1er pilier", "retraite"],
    body: (
      <>
        <p>La rente AVS dépend de deux paramètres : le <strong>nombre d'années de cotisation</strong> (échelle 44) et le <strong>revenu annuel moyen</strong> (RAM).</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>Cotisation obligatoire dès 18 ans (revenus) ou 21 ans (sans revenu).</li>
          <li><strong>Échelle 44</strong> = rente complète. Chaque année manquante = environ 1/44 de rente perdue.</li>
          <li><strong>Rente min 2026</strong> : 1 260 CHF/mois · <strong>max</strong> : 2 520 CHF/mois (célibataire).</li>
          <li><strong>Plafond couple</strong> : 150 % de la rente max individuelle (3 780 CHF).</li>
          <li>Bonifications éducatives (enfants &lt; 16 ans) et d'assistance ajoutées au RAM.</li>
        </ul>
      </>
    ),
  },
  {
    id: "avs-anticipation",
    category: "1er pilier · AVS / AI",
    title: "Anticiper ou différer sa rente AVS",
    tags: ["AVS", "anticipation", "ajournement"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Anticipation</strong> de 1 à 2 ans : réduction définitive de 6.8 % par année anticipée.</li>
        <li><strong>Ajournement</strong> de 1 à 5 ans : supplément de 5.2 % à 31.5 % selon durée.</li>
        <li>Les cotisations restent dues jusqu'à l'âge de référence même en cas d'anticipation.</li>
        <li>Calcul de rentabilité : croisement entre supplément et espérance de vie résiduelle.</li>
      </ul>
    ),
  },
  {
    id: "lpp-coordination",
    category: "2e pilier · LPP & rachats",
    title: "Salaire coordonné et déduction de coordination",
    tags: ["LPP", "salaire coordonné"],
    body: (
      <>
        <p>Le <strong>salaire coordonné</strong> est la base sur laquelle la caisse calcule les bonifications de vieillesse.</p>
        <p className="mt-2 font-mono text-xs bg-muted/50 p-2 rounded">salaire coordonné = min(brut ; plafond assuré 90 720) − déduction 26 460</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>La déduction s'applique <strong>après</strong> plafonnement au salaire assuré max.</li>
          <li>Salaire min d'entrée LPP 2026 : 22 680 CHF/an.</li>
          <li>Caisses surobligatoires (cadres, plans 1e) peuvent dépasser 90 720.</li>
        </ul>
      </>
    ),
  },
  {
    id: "lpp-credits",
    category: "2e pilier · LPP & rachats",
    title: "Bonifications de vieillesse par tranche d'âge",
    tags: ["LPP", "bonifications"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>25 à 34 ans</strong> : 7 % du salaire coordonné</li>
        <li><strong>35 à 44 ans</strong> : 10 %</li>
        <li><strong>45 à 54 ans</strong> : 15 %</li>
        <li><strong>55 à 65 ans</strong> : 18 %</li>
        <li>Versées 50/50 employé/employeur (minimum légal). Beaucoup de caisses font mieux côté employeur.</li>
      </ul>
    ),
  },
  {
    id: "lpp-rachat",
    category: "2e pilier · LPP & rachats",
    title: "Rachats LPP : levier fiscal majeur",
    tags: ["LPP", "rachat", "fiscalité"],
    body: (
      <>
        <p>Un rachat est <strong>déductible à 100 %</strong> du revenu imposable et capitalise dans la caisse au taux LPP minimum.</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li><strong>Blocage 3 ans</strong> : capital rachètié non retirable en capital pendant 3 ans (sinon reprise fiscale).</li>
          <li>Le <strong>plafond</strong> figure sur le certificat LPP (différence entre avoir cible et avoir actuel).</li>
          <li>Optimal de fractionner sur plusieurs années pour rester dans la tranche marginale haute.</li>
          <li>Économie d'impôt typique : 25 à 40 % du rachat selon canton et revenu.</li>
        </ul>
      </>
    ),
  },
  {
    id: "lpp-conversion",
    category: "2e pilier · LPP & rachats",
    title: "Taux de conversion : rente vs capital",
    tags: ["LPP", "conversion", "retraite"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
<li><strong>Taux retenu : 6.0 %</strong> (hypothèse prudente · taux légal minimal 2026 : 6.8 %, certaines caisses appliquent déjà 5.5 %).</li>  
      <li>Capital de 500 000 CHF × 6.0 % = 30 000 CHF de rente annuelle viagère.</li>
        <li><strong>Rente</strong> : sécurité à vie + rente de conjoint, mais imposée à 100 %.</li>
        <li><strong>Capital</strong> : flexibilité + transmission héritiers, mais imposé une fois (taux réduit) puis fortune imposable.</li>
        <li>Mixte 50/50 souvent optimal. Décision irrévocable, à signifier 3 ans avant la retraite en général.</li>
      </ul>
    ),
  },
  {
    id: "p3a-base",
    category: "3e pilier · A & B",
    title: "3a : plafonds et règles",
    tags: ["3a", "déduction", "fiscalité"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Salarié affilié LPP</strong> : 7 258 CHF/an (2026), 100 % déductible.</li>
        <li><strong>Indépendant sans LPP</strong> : 20 % du revenu net, max 36 288 CHF.</li>
        <li>Capital bloqué jusqu'à 5 ans avant l'âge AVS de référence.</li>
        <li>Imposé au retrait à <strong>taux réduit séparé</strong> (1/5 du barème ordinaire en moyenne).</li>
        <li>Stratégie : ouvrir 3 à 5 comptes 3a et les retirer sur années différentes pour fractionner l'impôt.</li>
      </ul>
    ),
  },
  {
    id: "p3b-base",
    category: "3e pilier · A & B",
    title: "3b libre : assurance-vie et épargne",
    tags: ["3b", "épargne libre"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Pas de plafond</strong>, capital disponible à tout moment.</li>
        <li><strong>Pas de déduction</strong> du revenu (sauf cantons GE et FR avec plafonds modestes).</li>
        <li>Retrait <strong>généralement exonéré</strong> de l'impôt sur le revenu si contrat ≥ 5 ans et souscrit avant 66 ans.</li>
        <li>Capital cumulé entre dans la fortune imposable.</li>
        <li>Utile pour : sur-épargner après saturation du 3a, planifier transmission, financer un projet pré-retraite.</li>
      </ul>
    ),
  },
  {
    id: "frontaliers",
    category: "Frontaliers & impôt source",
    title: "Imposition à la source vs ordinaire",
    tags: ["source", "frontalier", "TOU"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Permis B/G + revenu &lt; 120 000</strong> : imposition à la source par défaut (barème A/B/C selon situation).</li>
        <li><strong>TOU (Taxation Ordinaire Ultérieure)</strong> : possibilité de demander la taxation ordinaire si ≥ 90 % du revenu mondial est suisse.</li>
        <li>Permet de déduire 3a, rachats LPP, intérêts hypothécaires, frais professionnels réels.</li>
        <li>Demande à déposer avant le 31 mars de l'année suivante. Engagement irrévocable les années suivantes.</li>
        <li><strong>Frontaliers VD/GE</strong> : retenue 4.5 % rétrocédée à la France. Imposition principale en France.</li>
      </ul>
    ),
  },
  {
    id: "ifd-icc",
    category: "Fiscalité",
    title: "IFD, ICC, multiplicateurs : la trinité fiscale",
    tags: ["IFD", "ICC", "communal"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>IFD</strong> (Impôt Fédéral Direct) : barème unique national, max 11.5 %.</li>
        <li><strong>ICC</strong> (Impôt Cantonal et Communal) : barème de base cantonal × coefficient cantonal × multiplicateur communal.</li>
        <li>Exemple Vaud : barème × 154.5 (canton) × 78 (Lausanne) / 100.</li>
        <li><strong>Impôt ecclésiastique</strong> : ajouté si confession déclarée (catholique, protestante).</li>
        <li>Charge globale typique : 18 à 35 % selon canton, commune et revenu.</li>
      </ul>
    ),
  },
  {
    id: "fortune",
    category: "Fiscalité",
    title: "Impôt sur la fortune : assiette et exonérations",
    tags: ["fortune", "patrimoine"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Assiette : tous les biens (immobilier valeur fiscale, comptes, titres, véhicules, 3b).</li>
        <li><strong>Exonéré</strong> : avoirs LPP et 3a tant que non retirés.</li>
        <li>Dettes (hypothèque, prêts) déductibles à 100 %.</li>
        <li>Taux progressif cantonal, généralement 0.1 à 0.7 % du net.</li>
        <li>Bouclier fiscal dans certains cantons (GE, VD) : impôt total ≤ 60 % du revenu.</li>
      </ul>
    ),
  },
  {
    id: "valeur-locative",
    category: "Fiscalité",
    title: "Valeur locative et déductions immobilières",
    tags: ["immobilier", "valeur locative"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Propriétaire occupant : <strong>valeur locative</strong> ajoutée au revenu (60 à 70 % du loyer théorique).</li>
        <li>Déductions : intérêts hypothécaires, frais d'entretien (forfait 10 ou 20 % selon âge du bien, ou frais réels).</li>
        <li>Travaux à valeur ajoutée non déductibles (sauf énergétiques dans certains cantons).</li>
        <li>Réforme nationale en cours : valeur locative pourrait disparaître à moyen terme.</li>
      </ul>
    ),
  },
  {
    id: "dirigeant",
    category: "Dirigeant de société",
    title: "Salaire vs dividende : optimisation 2 niveaux",
    tags: ["dirigeant", "dividende", "SARL", "SA"],
    body: (
      <>
        <p>Pour un dirigeant actionnaire, l'arbitrage salaire/dividende joue sur :</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li><strong>Salaire</strong> : charges sociales (12.8 % AVS/AI/APG salarié + employeur, LPP 7-18 %), déductible côté société.</li>
          <li><strong>Dividende</strong> : pas de charges sociales mais <strong>double imposition économique</strong> (impôt société + impôt privé).</li>
          <li><strong>Imposition privilégiée</strong> : si participation ≥ 10 %, dividendes taxés à 50 % (fédéral) et 50-70 % (cantonal).</li>
          <li>Règle pratique : couvrir le besoin LPP/AVS avec un salaire « réaliste », puis sortir le surplus en dividende.</li>
          <li>Attention au <strong>salaire usage</strong> contesté par AVS si trop bas (rappel + amende possible).</li>
        </ul>
      </>
    ),
  },
  {
    id: "simulations-multiples",
    category: "Synthèse & rendez-vous",
    title: "Comparer plusieurs situations avec un même calculateur",
    tags: ["simulation", "comparaison", "synthèse", "avant/après"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Un même calculateur peut être <strong>sauvegardé plusieurs fois</strong> pour un même client : rien n'empêche d'enregistrer une première fois « tel quel », puis de modifier certains paramètres (état civil, canton, rachat LPP, etc.) et de sauvegarder à nouveau.</li>
        <li>Chaque sauvegarde crée une <strong>entrée distincte</strong> dans l'historique du client, visible dans « Simulations rattachées » sur sa fiche.</li>
        <li>Utilité concrète : simuler « Situation actuelle » vs « Situation après un changement de vie » (mariage, naissance, déménagement, rachat LPP) pour un même client, sur le même calculateur.</li>
        <li>Ces deux versions peuvent ensuite être <strong>sélectionnées ensemble</strong> au moment de générer le dossier de synthèse PDF, pour que le client voie noir sur blanc l'impact chiffré du changement.</li>
        <li>Pense à donner un titre clair à chaque simulation (champ « Titre » lors de la sauvegarde) pour les distinguer facilement dans la liste, par exemple « Fiscal global · situation actuelle » et « Fiscal global · après mariage ».</li>
      </ul>
    ),
  },
  {
    id: "synthese-pdf",
    category: "Synthèse & rendez-vous",
    title: "Générer la synthèse PDF du rendez-vous",
    tags: ["pdf", "synthèse", "rendez-vous", "paiement"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Le dossier de synthèse PDF se génère depuis la fiche client, onglet « Synthèse RDV », une fois qu'au moins une simulation a été sauvegardée.</li>
        <li>Toutes les simulations sauvegardées pour ce client apparaissent dans « Simulations rattachées » : possibilité de <strong>sélectionner tout</strong> ou seulement certaines, selon ce qui est pertinent pour le rendez-vous en cours.</li>
        <li>La génération du PDF est <strong>débloquée après paiement</strong> du rendez-vous par le client (minimum 80 CHF), via le bouton « Facturer ce RDV » qui crée un lien de paiement Stripe.</li>
        <li>Le PDF final contient : le profil du client, une page par simulation sélectionnée (paramètres, résultats, analyse rédigée), un tableau comparatif avant/après, et une conclusion avec recommandations chiffrées.</li>
        <li>Le nom du cabinet, le logo et les coordonnées affichés dans le PDF proviennent du profil courtier (« Mon profil »), pensez à les renseigner avant le premier envoi à un client.</li>
      </ul>
    ),
  },
  {
    id: "profil-courtier-paiements",
    category: "Prise en main",
    title: "Compléter son profil courtier (paiements, RIB)",
    tags: ["profil", "stripe", "paiement", "rib", "iban"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Pour pouvoir facturer un rendez-vous et débloquer les synthèses PDF, le courtier doit d'abord <strong>connecter son compte bancaire</strong> via Stripe Connect, depuis « Mon profil ».</li>
        <li>Sans cette étape, toute tentative de facturation renvoie une erreur explicite invitant à compléter le profil, aucun paiement ne peut être encaissé tant que ce n'est pas fait.</li>
        <li>Une fois le compte connecté, une commission de 10 % est prélevée automatiquement par la plateforme sur chaque paiement encaissé, le solde étant transféré directement au courtier.</li>
        <li>Le profil permet aussi de personnaliser les rapports PDF envoyés aux clients : nom du cabinet, logo, couleurs, mention de pied de page.</li>
      </ul>
    ),
  },
];

// =====================================================================
// DE · Schweizerdeutsch (Hochdeutsch CH), Terminologie offiziell
// =====================================================================
const DE: WikiArticle[] = [
  {
    id: "demarrage",
    category: "Erste Schritte",
    title: "Erste Schritte in SwissBroker Pro",
    tags: ["Einführung", "Berater", "Kunde"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Kunde anlegen</strong>: Menü Kunden → Neuer Kunde. Identität, Kanton, Zivilstand, Lohn erfassen.</li>
        <li><strong>Berechnung starten</strong>: Aus dem Kundendossier einen Rechner in der Seitenleiste wählen (automatisches Vorausfüllen).</li>
        <li><strong>Speichern</strong>: Schaltfläche «Speichern» am Ende jedes Rechners. Wieder auffindbar im Verlauf.</li>
        <li><strong>Exportieren</strong>: PDF-Schaltfläche zur Erstellung eines versandfertigen Kundenberichts.</li>
        <li><strong>Geführter Modus</strong>: Schaltfläche oben rechts in jedem Rechner. Interaktive Feld-Tour.</li>
      </ul>
    ),
  },
  {
    id: "wiki-clients",
    category: "Erste Schritte",
    title: "Kundendossier: was erfassen?",
    tags: ["Kunde", "Daten"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Kanton + Gemeinde</strong>: unerlässlich für die Gemeindemultiplikatoren und den Staats- und Gemeindesteuertarif.</li>
        <li><strong>Zivilstand + Konfession</strong>: beeinflusst den Tarif (verheiratet = Teilsplitting) und die Kirchensteuer.</li>
        <li><strong>Ausweis</strong>: Ausweis B / G löst die Quellensteuer aus.</li>
        <li><strong>Vorsorge</strong>: BVG-Guthaben, Einkaufspotenzial, 3a/3b-Konten. Für BVG, Freizügigkeit und Pensionierung verwendet.</li>
        <li><strong>Vermögen</strong>: Immobilien, Wertschriften, Konten. Für Vermögenssteuer und Eigenmietwert verwendet.</li>
      </ul>
    ),
  },
  {
    id: "avs-base",
    category: "1. Säule · AHV / IV",
    title: "Wie die AHV-Rente funktioniert",
    tags: ["AHV", "IV", "1. Säule", "Pensionierung"],
    body: (
      <>
        <p>Die AHV-Rente hängt von zwei Parametern ab: der <strong>Anzahl Beitragsjahre</strong> (Skala 44) und dem <strong>durchschnittlichen Jahreseinkommen</strong> (massgebendes Einkommen).</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>Beitragspflicht ab 18 Jahren (mit Erwerb) oder 21 Jahren (ohne Erwerb).</li>
          <li><strong>Skala 44</strong> = Vollrente. Jedes fehlende Jahr = ca. 1/44 Rente weniger.</li>
          <li><strong>Mindestrente 2026</strong>: 1'260 CHF/Monat · <strong>Maximum</strong>: 2'520 CHF/Monat (Einzelperson).</li>
          <li><strong>Plafond Ehepaare</strong>: 150 % der individuellen Maximalrente (3'780 CHF).</li>
          <li>Erziehungs- (Kinder &lt; 16 Jahre) und Betreuungsgutschriften werden zum massgebenden Einkommen addiert.</li>
        </ul>
      </>
    ),
  },
  {
    id: "avs-anticipation",
    category: "1. Säule · AHV / IV",
    title: "AHV-Rente vorbeziehen oder aufschieben",
    tags: ["AHV", "Vorbezug", "Aufschub"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Vorbezug</strong> 1 bis 2 Jahre: lebenslange Kürzung von 6.8 % pro vorbezogenem Jahr.</li>
        <li><strong>Aufschub</strong> 1 bis 5 Jahre: Zuschlag von 5.2 % bis 31.5 % je nach Dauer.</li>
        <li>Beiträge bleiben auch bei Vorbezug bis zum Referenzalter geschuldet.</li>
        <li>Rentabilitätsrechnung: Abwägung zwischen Zuschlag und Restlebenserwartung.</li>
      </ul>
    ),
  },
  {
    id: "lpp-coordination",
    category: "2. Säule · BVG & Einkäufe",
    title: "Koordinierter Lohn und Koordinationsabzug",
    tags: ["BVG", "koordinierter Lohn"],
    body: (
      <>
        <p>Der <strong>koordinierte Lohn</strong> ist die Basis, auf der die Pensionskasse die Altersgutschriften berechnet.</p>
        <p className="mt-2 font-mono text-xs bg-muted/50 p-2 rounded">koordinierter Lohn = min(brutto; max. versicherter Lohn 90'720) − Abzug 26'460</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>Der Abzug wird <strong>nach</strong> der Plafonierung auf den max. versicherten Lohn angewendet.</li>
          <li>Eintrittsschwelle BVG 2026: 22'680 CHF/Jahr.</li>
          <li>Überobligatorische Kassen (Kader, 1e-Pläne) können 90'720 überschreiten.</li>
        </ul>
      </>
    ),
  },
  {
    id: "lpp-credits",
    category: "2. Säule · BVG & Einkäufe",
    title: "Altersgutschriften nach Altersgruppe",
    tags: ["BVG", "Altersgutschriften"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>25 bis 34 Jahre</strong>: 7 % des koordinierten Lohns</li>
        <li><strong>35 bis 44 Jahre</strong>: 10 %</li>
        <li><strong>45 bis 54 Jahre</strong>: 15 %</li>
        <li><strong>55 bis 65 Jahre</strong>: 18 %</li>
        <li>50/50 Arbeitnehmer/Arbeitgeber (gesetzliches Minimum). Viele Kassen leisten arbeitgeberseitig mehr.</li>
      </ul>
    ),
  },
  {
    id: "lpp-rachat",
    category: "2. Säule · BVG & Einkäufe",
    title: "BVG-Einkäufe: wichtiger Steuerhebel",
    tags: ["BVG", "Einkauf", "Steuern"],
    body: (
      <>
        <p>Ein Einkauf ist <strong>zu 100 % vom steuerbaren Einkommen abzugsfähig</strong> und wird in der Kasse zum BVG-Mindestzins kapitalisiert.</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li><strong>3-Jahres-Sperrfrist</strong>: eingekauftes Kapital während 3 Jahren nicht als Kapital beziehbar (sonst steuerliche Nachveranlagung).</li>
          <li>Das <strong>Einkaufspotenzial</strong> steht auf dem BVG-Ausweis (Differenz zwischen Soll- und Ist-Guthaben).</li>
          <li>Optimal über mehrere Jahre staffeln, um in der oberen Grenztarifstufe zu bleiben.</li>
          <li>Typische Steuerersparnis: 25 bis 40 % des Einkaufs je nach Kanton und Einkommen.</li>
        </ul>
      </>
    ),
  },
  {
    id: "lpp-conversion",
    category: "2. Säule · BVG & Einkäufe",
    title: "Umwandlungssatz: Rente vs. Kapital",
    tags: ["BVG", "Umwandlung", "Pensionierung"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
<li><strong>Angewandter Satz: 6.0 %</strong> (vorsichtige Hypothese · gesetzlicher Mindestsatz 2026: 6.8 %, manche Kassen wenden bereits 5.5 % an).</li>       
<li>Kapital von 500'000 CHF × 6.0 % = 30'000 CHF lebenslange Jahresrente.</li>
        <li><strong>Rente</strong>: lebenslange Sicherheit + Ehegattenrente, aber zu 100 % steuerbar.</li>
        <li><strong>Kapital</strong>: Flexibilität + Vererbung, aber einmalig (zu reduziertem Satz) besteuert, danach vermögenssteuerpflichtig.</li>
        <li>50/50-Mix oft optimal. Unwiderruflicher Entscheid, in der Regel 3 Jahre vor der Pensionierung anzukündigen.</li>
      </ul>
    ),
  },
  {
    id: "p3a-base",
    category: "3. Säule · A & B",
    title: "Säule 3a: Maximalbeträge und Regeln",
    tags: ["3a", "Abzug", "Steuern"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Arbeitnehmer mit BVG</strong>: 7'258 CHF/Jahr (2026), 100 % abzugsfähig.</li>
        <li><strong>Selbstständige ohne BVG</strong>: 20 % des Nettoeinkommens, max. 36'288 CHF.</li>
        <li>Kapital gesperrt bis 5 Jahre vor dem AHV-Referenzalter.</li>
        <li>Beim Bezug zu <strong>reduziertem separatem Satz</strong> besteuert (im Schnitt 1/5 des ordentlichen Tarifs).</li>
        <li>Strategie: 3 bis 5 Säule-3a-Konten eröffnen und in verschiedenen Jahren beziehen, um die Steuer zu staffeln.</li>
      </ul>
    ),
  },
  {
    id: "p3b-base",
    category: "3. Säule · A & B",
    title: "Säule 3b: freie Lebensversicherung und Sparen",
    tags: ["3b", "freies Sparen"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Kein Maximalbetrag</strong>, Kapital jederzeit verfügbar.</li>
        <li><strong>Kein Einkommensabzug</strong> (ausser Kantone GE und FR mit bescheidenen Maxima).</li>
        <li>Bezug <strong>in der Regel einkommenssteuerbefreit</strong>, wenn Vertrag ≥ 5 Jahre läuft und vor Alter 66 abgeschlossen wurde.</li>
        <li>Kumuliertes Kapital fliesst in das steuerbare Vermögen ein.</li>
        <li>Nützlich für: zusätzliches Sparen nach Ausschöpfung der Säule 3a, Nachlassplanung, Finanzierung eines Projekts vor der Pensionierung.</li>
      </ul>
    ),
  },
  {
    id: "frontaliers",
    category: "Grenzgänger & Quellensteuer",
    title: "Quellensteuer vs. ordentliche Veranlagung",
    tags: ["Quellensteuer", "Grenzgänger", "NOV"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Ausweis B/G + Einkommen &lt; 120'000</strong>: standardmässig Quellenbesteuerung (Tarif A/B/C je nach Situation).</li>
        <li><strong>NOV (Nachträgliche ordentliche Veranlagung)</strong>: Möglichkeit, die ordentliche Veranlagung zu beantragen, wenn ≥ 90 % des Welteinkommens schweizerisch ist.</li>
        <li>Erlaubt den Abzug von Säule 3a, BVG-Einkäufen, Hypothekarzinsen, effektiven Berufsauslagen.</li>
        <li>Antrag bis 31. März des Folgejahres einzureichen. Unwiderrufliche Bindung für die Folgejahre.</li>
        <li><strong>Grenzgänger VD/GE</strong>: Quellensteuer 4.5 % an Frankreich rückerstattet. Hauptbesteuerung in Frankreich.</li>
      </ul>
    ),
  },
  {
    id: "ifd-icc",
    category: "Steuern",
    title: "DBSt, StG, Multiplikatoren: die Steuer-Trinität",
    tags: ["DBSt", "StG", "Gemeinde"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>DBSt</strong> (direkte Bundessteuer): einheitlicher Bundestarif, max. 11.5 %.</li>
        <li><strong>StG</strong> (Staats- und Gemeindesteuer): kantonaler Grundtarif × kantonaler Koeffizient × Gemeindemultiplikator.</li>
        <li>Beispiel Waadt: Tarif × 154.5 (Kanton) × 78 (Lausanne) / 100.</li>
        <li><strong>Kirchensteuer</strong>: zusätzlich bei deklarierter Konfession (katholisch, evangelisch).</li>
        <li>Typische Gesamtbelastung: 18 bis 35 % je nach Kanton, Gemeinde und Einkommen.</li>
      </ul>
    ),
  },
  {
    id: "fortune",
    category: "Steuern",
    title: "Vermögenssteuer: Bemessungsgrundlage und Befreiungen",
    tags: ["Vermögen", "Patrimonium"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Bemessungsgrundlage: alle Vermögenswerte (Immobilien zum Steuerwert, Konten, Wertschriften, Fahrzeuge, 3b).</li>
        <li><strong>Befreit</strong>: BVG- und Säule-3a-Guthaben, solange nicht bezogen.</li>
        <li>Schulden (Hypothek, Darlehen) zu 100 % abzugsfähig.</li>
        <li>Kantonal progressiver Satz, in der Regel 0.1 bis 0.7 % des Nettovermögens.</li>
        <li>Steuerbremse in einigen Kantonen (GE, VD): Gesamtsteuer ≤ 60 % des Einkommens.</li>
      </ul>
    ),
  },
  {
    id: "valeur-locative",
    category: "Steuern",
    title: "Eigenmietwert und Immobilienabzüge",
    tags: ["Immobilien", "Eigenmietwert"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Selbstnutzender Eigentümer: <strong>Eigenmietwert</strong> wird zum Einkommen hinzugefügt (60 bis 70 % der theoretischen Miete).</li>
        <li>Abzüge: Hypothekarzinsen, Unterhaltskosten (Pauschale 10 oder 20 % je nach Alter der Liegenschaft, oder effektive Kosten).</li>
        <li>Wertvermehrende Investitionen nicht abzugsfähig (ausser energetische Massnahmen in einigen Kantonen).</li>
        <li>Nationale Reform im Gang: der Eigenmietwert könnte mittelfristig abgeschafft werden.</li>
      </ul>
    ),
  },
  {
    id: "dirigeant",
    category: "Geschäftsführer",
    title: "Lohn vs. Dividende: zweistufige Optimierung",
    tags: ["Geschäftsführer", "Dividende", "GmbH", "AG"],
    body: (
      <>
        <p>Für einen Geschäftsführer mit Beteiligung wirkt der Lohn-/Dividenden-Mix auf:</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li><strong>Lohn</strong>: Sozialabgaben (12.8 % AHV/IV/EO Arbeitnehmer + Arbeitgeber, BVG 7-18 %), gesellschaftsseitig abzugsfähig.</li>
          <li><strong>Dividende</strong>: keine Sozialabgaben, aber <strong>wirtschaftliche Doppelbesteuerung</strong> (Unternehmenssteuer + Privatsteuer).</li>
          <li><strong>Privilegierte Besteuerung</strong>: bei Beteiligung ≥ 10 % werden Dividenden zu 50 % (Bund) und 50-70 % (Kanton) besteuert.</li>
          <li>Faustregel: BVG/AHV-Bedarf mit einem «realistischen» Lohn abdecken, dann Überschuss als Dividende beziehen.</li>
          <li>Achtung auf den <strong>Branchenüblichen Lohn</strong>, von der AHV bei zu tiefem Ansatz angefochten (Aufrechnung + Busse möglich).</li>
        </ul>
      </>
    ),
  },
  {
    id: "simulations-multiples",
    category: "Synthese & Termin",
    title: "Mehrere Situationen mit demselben Rechner vergleichen",
    tags: ["simulation", "vergleich", "synthese"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Derselbe Rechner kann für denselben Kunden <strong>mehrmals gespeichert</strong> werden: zuerst «wie sie ist», dann nach Änderung bestimmter Parameter (Zivilstand, Kanton, LPP-Einkauf usw.) erneut speichern.</li>
        <li>Jede Speicherung erstellt einen <strong>eigenen Eintrag</strong> in der Kundenhistorie, sichtbar unter «Verknüpfte Simulationen» im Kundendossier.</li>
        <li>Konkreter Nutzen: «Aktuelle Situation» vs. «Situation nach einer Lebensveränderung» (Heirat, Geburt, Umzug, LPP-Einkauf) für denselben Kunden simulieren.</li>
        <li>Beide Versionen können anschliessend gemeinsam für die PDF-Synthese <strong>ausgewählt</strong> werden, damit der Kunde die konkreten Auswirkungen schwarz auf weiss sieht.</li>
        <li>Jeder Simulation einen klaren Titel geben (Feld «Titel» beim Speichern), um sie in der Liste leicht zu unterscheiden.</li>
      </ul>
    ),
  },
  {
    id: "synthese-pdf",
    category: "Synthese & Termin",
    title: "PDF-Synthese des Termins erstellen",
    tags: ["pdf", "synthese", "termin", "zahlung"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Die PDF-Synthese wird im Kundendossier unter «RDV-Synthese» erstellt, sobald mindestens eine Simulation gespeichert wurde.</li>
        <li>Alle gespeicherten Simulationen erscheinen unter «Verknüpfte Simulationen»: es können <strong>alle oder nur bestimmte</strong> ausgewählt werden.</li>
        <li>Die PDF-Erstellung wird erst nach <strong>Zahlung</strong> des Termins durch den Kunden freigeschaltet (mindestens 80 CHF), über den Button «Termin fakturieren».</li>
        <li>Das PDF enthält: Kundenprofil, eine Seite pro ausgewählter Simulation, eine Vorher/Nachher-Tabelle und eine Schlussfolgerung mit bezifferten Empfehlungen.</li>
        <li>Kanzleiname, Logo und Kontaktdaten im PDF stammen aus dem Maklerprofil («Mein Profil»).</li>
      </ul>
    ),
  },
  {
    id: "profil-courtier-paiements",
    category: "Erste Schritte",
    title: "Maklerprofil vervollständigen (Zahlungen, Bankkonto)",
    tags: ["profil", "stripe", "zahlung", "iban"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Um einen Termin zu fakturieren und PDF-Synthesen freizuschalten, muss der Makler zuerst sein <strong>Bankkonto verbinden</strong> via Stripe Connect, unter «Mein Profil».</li>
        <li>Ohne diesen Schritt zeigt jeder Fakturierungsversuch einen klaren Fehler an.</li>
        <li>Nach der Verbindung wird automatisch eine Provision von 10 % einbehalten, der Rest wird direkt an den Makler überwiesen.</li>
        <li>Das Profil erlaubt auch die Personalisierung der PDF-Berichte: Kanzleiname, Logo, Farben, Fusszeile.</li>
      </ul>
    ),
  },
];

// =====================================================================
// EN · Swiss English, official terminology
// =====================================================================
const EN: WikiArticle[] = [
  {
    id: "demarrage",
    category: "Getting started",
    title: "First steps in SwissBroker Pro",
    tags: ["intro", "broker", "client"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Create a client</strong>: Clients menu → New client. Fill in identity, canton, marital status, salary.</li>
        <li><strong>Run a calculation</strong>: from the client file, pick a calculator in the side bar (auto pre-fill).</li>
        <li><strong>Save</strong>: «Save» button at the bottom of every calculator. Available again in History.</li>
        <li><strong>Export</strong>: PDF button to generate a client-ready report.</li>
        <li><strong>Guide mode</strong>: button at the top right of every calculator. Interactive field tour.</li>
      </ul>
    ),
  },
  {
    id: "wiki-clients",
    category: "Getting started",
    title: "Client file: what to fill in?",
    tags: ["client", "data"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Canton + commune</strong>: essential for communal multipliers and the cantonal/communal tax scale.</li>
        <li><strong>Marital status + denomination</strong>: affects the scale (married = partial splitting) and church tax.</li>
        <li><strong>Permit</strong>: B / G permits trigger withholding tax.</li>
        <li><strong>Pension</strong>: BVG savings, buy-back potential, 3a/3b accounts. Used for BVG, vested benefits, retirement.</li>
        <li><strong>Wealth</strong>: real estate, securities, accounts. Used for wealth tax and imputed rental value.</li>
      </ul>
    ),
  },
  {
    id: "avs-base",
    category: "1st pillar · AHV / IV",
    title: "How the AHV pension works",
    tags: ["AHV", "IV", "1st pillar", "retirement"],
    body: (
      <>
        <p>The AHV pension depends on two parameters: the <strong>number of contribution years</strong> (scale 44) and the <strong>average annual income</strong>.</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>Mandatory contribution from age 18 (with income) or 21 (without income).</li>
          <li><strong>Scale 44</strong> = full pension. Each missing year = roughly 1/44 of pension lost.</li>
          <li><strong>Min pension 2026</strong>: CHF 1,260/month · <strong>max</strong>: CHF 2,520/month (single).</li>
          <li><strong>Couple ceiling</strong>: 150% of the individual maximum pension (CHF 3,780).</li>
          <li>Educational (children &lt; 16) and care credits added to the average income.</li>
        </ul>
      </>
    ),
  },
  {
    id: "avs-anticipation",
    category: "1st pillar · AHV / IV",
    title: "Drawing the AHV pension early or deferring it",
    tags: ["AHV", "early", "deferral"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Early withdrawal</strong> 1 to 2 years: permanent reduction of 6.8% per year drawn early.</li>
        <li><strong>Deferral</strong> 1 to 5 years: supplement of 5.2% to 31.5% depending on duration.</li>
        <li>Contributions remain due up to the reference age even with early withdrawal.</li>
        <li>Profitability check: weighing the supplement against residual life expectancy.</li>
      </ul>
    ),
  },
  {
    id: "lpp-coordination",
    category: "2nd pillar · BVG & buy-backs",
    title: "Coordinated salary and coordination deduction",
    tags: ["BVG", "coordinated salary"],
    body: (
      <>
        <p>The <strong>coordinated salary</strong> is the basis on which the pension fund computes retirement credits.</p>
        <p className="mt-2 font-mono text-xs bg-muted/50 p-2 rounded">coordinated salary = min(gross; insured ceiling 90,720) − deduction 26,460</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>The deduction applies <strong>after</strong> capping at the maximum insured salary.</li>
          <li>BVG entry threshold 2026: CHF 22,680/year.</li>
          <li>Extra-mandatory funds (executives, 1e plans) may exceed 90,720.</li>
        </ul>
      </>
    ),
  },
  {
    id: "lpp-credits",
    category: "2nd pillar · BVG & buy-backs",
    title: "Retirement credits by age band",
    tags: ["BVG", "credits"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>25 to 34</strong>: 7% of the coordinated salary</li>
        <li><strong>35 to 44</strong>: 10%</li>
        <li><strong>45 to 54</strong>: 15%</li>
        <li><strong>55 to 65</strong>: 18%</li>
        <li>Paid 50/50 employee/employer (legal minimum). Many funds offer more on the employer side.</li>
      </ul>
    ),
  },
  {
    id: "lpp-rachat",
    category: "2nd pillar · BVG & buy-backs",
    title: "BVG buy-backs: a major tax lever",
    tags: ["BVG", "buy-back", "tax"],
    body: (
      <>
        <p>A buy-back is <strong>100% deductible</strong> from taxable income and capitalized in the fund at the BVG minimum rate.</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li><strong>3-year lock-up</strong>: capital bought back cannot be withdrawn as a lump sum for 3 years (otherwise tax recapture).</li>
          <li>The <strong>buy-back potential</strong> is shown on the BVG certificate (gap between target and current savings).</li>
          <li>Best to spread over several years to stay in the top marginal bracket.</li>
          <li>Typical tax saving: 25 to 40% of the buy-back depending on canton and income.</li>
        </ul>
      </>
    ),
  },
  {
    id: "lpp-conversion",
    category: "2nd pillar · BVG & buy-backs",
    title: "Conversion rate: pension vs lump-sum",
    tags: ["BVG", "conversion", "retirement"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
<li><strong>Rate used: 6.0%</strong> (prudent assumption · legal minimum 2026: 6.8%, some funds already apply 5.5%).</li>
        <li>CHF 500,000 capital × 6.0% = CHF 30,000 lifetime annual pension.</li>
        <li><strong>Pension</strong>: lifelong security + spouse's pension, but 100% taxed.</li>
        <li><strong>Lump-sum</strong>: flexibility + transmission to heirs, but taxed once (reduced rate) then becomes taxable wealth.</li>
        <li>50/50 mix often optimal. Irrevocable decision, usually announced 3 years before retirement.</li>
      </ul>
    ),
  },
  {
    id: "p3a-base",
    category: "3rd pillar · A & B",
    title: "Pillar 3a: ceilings and rules",
    tags: ["3a", "deduction", "tax"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Employee with BVG</strong>: CHF 7,258/year (2026), 100% deductible.</li>
        <li><strong>Self-employed without BVG</strong>: 20% of net income, max CHF 36,288.</li>
        <li>Capital locked until 5 years before the AHV reference age.</li>
        <li>Taxed at withdrawal at a <strong>reduced separate rate</strong> (about 1/5 of the ordinary scale).</li>
        <li>Strategy: open 3 to 5 Pillar 3a accounts and withdraw them in different years to spread the tax.</li>
      </ul>
    ),
  },
  {
    id: "p3b-base",
    category: "3rd pillar · A & B",
    title: "Pillar 3b: free life insurance and savings",
    tags: ["3b", "free savings"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>No ceiling</strong>, capital available at any time.</li>
        <li><strong>No income deduction</strong> (except cantons GE and FR with modest caps).</li>
        <li>Withdrawal <strong>generally exempt</strong> from income tax if contract ≥ 5 years and signed before age 66.</li>
        <li>Accumulated capital is part of taxable wealth.</li>
        <li>Useful for: extra saving once Pillar 3a is full, estate planning, financing a pre-retirement project.</li>
      </ul>
    ),
  },
  {
    id: "frontaliers",
    category: "Cross-border workers & withholding tax",
    title: "Withholding tax vs ordinary assessment",
    tags: ["withholding", "cross-border", "subsequent"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Permit B/G + income &lt; 120,000</strong>: withholding tax by default (scale A/B/C depending on situation).</li>
        <li><strong>Subsequent ordinary assessment (TOU)</strong>: option to request ordinary assessment if ≥ 90% of worldwide income is Swiss.</li>
        <li>Allows deduction of Pillar 3a, BVG buy-backs, mortgage interest, actual professional expenses.</li>
        <li>Request to be filed by 31 March of the following year. Irrevocable commitment for the following years.</li>
        <li><strong>Cross-border workers VD/GE</strong>: 4.5% withholding rebated to France. Main taxation in France.</li>
      </ul>
    ),
  },
  {
    id: "ifd-icc",
    category: "Tax",
    title: "DFT, cantonal/communal, multipliers: the tax trinity",
    tags: ["DFT", "cantonal/communal", "communal"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>DFT</strong> (Direct Federal Tax): single national scale, max 11.5%.</li>
        <li><strong>Cantonal/communal tax</strong>: cantonal base scale × cantonal coefficient × communal multiplier.</li>
        <li>Vaud example: scale × 154.5 (canton) × 78 (Lausanne) / 100.</li>
        <li><strong>Church tax</strong>: added if a denomination is declared (Catholic, Protestant).</li>
        <li>Typical total burden: 18 to 35% depending on canton, commune and income.</li>
      </ul>
    ),
  },
  {
    id: "simulations-multiples",
    category: "Summary & Meeting",
    title: "Comparing multiple situations with the same calculator",
    tags: ["simulation", "comparison", "summary"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>The same calculator can be <strong>saved multiple times</strong> for the same client: save it once "as is", then change certain parameters (marital status, canton, LPP buyback, etc.) and save again.</li>
        <li>Each save creates a <strong>separate entry</strong> in the client's history, visible under "Linked simulations" on their file.</li>
        <li>Practical use: simulate "Current situation" vs. "Situation after a life change" (marriage, birth, relocation, LPP buyback) for the same client.</li>
        <li>Both versions can then be <strong>selected together</strong> when generating the PDF summary, so the client sees the concrete impact of the change in black and white.</li>
        <li>Give each simulation a clear title (the "Title" field when saving) to distinguish them easily in the list.</li>
      </ul>
    ),
  },
  {
    id: "synthese-pdf",
    category: "Summary & Meeting",
    title: "Generating the meeting PDF summary",
    tags: ["pdf", "summary", "meeting", "payment"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>The PDF summary is generated from the client's file, "Meeting summary" tab, once at least one simulation has been saved.</li>
        <li>All saved simulations for that client appear under "Linked simulations": you can select <strong>all or only some</strong> of them.</li>
        <li>PDF generation is <strong>unlocked after payment</strong> of the meeting by the client (minimum CHF 80), via the "Invoice this meeting" button.</li>
        <li>The final PDF includes: the client profile, one page per selected simulation, a before/after comparison table, and a conclusion with quantified recommendations.</li>
        <li>The firm name, logo and contact details shown in the PDF come from the broker profile ("My profile").</li>
      </ul>
    ),
  },
  {
    id: "profil-courtier-paiements",
    category: "Getting started",
    title: "Completing your broker profile (payments, bank account)",
    tags: ["profile", "stripe", "payment", "iban"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>To invoice a meeting and unlock PDF summaries, the broker must first <strong>connect their bank account</strong> via Stripe Connect, from "My profile".</li>
        <li>Without this step, any invoicing attempt returns a clear error.</li>
        <li>Once connected, a 10% commission is automatically deducted, the rest being transferred directly to the broker.</li>
        <li>The profile also allows customizing PDF reports: firm name, logo, colors, footer note.</li>
      </ul>
    ),
  },
  {
    id: "fortune",
    category: "Tax",
    title: "Wealth tax: base and exemptions",
    tags: ["wealth", "assets"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Base: all assets (real estate at tax value, accounts, securities, vehicles, 3b).</li>
        <li><strong>Exempt</strong>: BVG and Pillar 3a savings as long as not withdrawn.</li>
        <li>Debts (mortgage, loans) 100% deductible.</li>
        <li>Cantonal progressive rate, generally 0.1 to 0.7% of net wealth.</li>
        <li>Tax shield in some cantons (GE, VD): total tax ≤ 60% of income.</li>
      </ul>
    ),
  },
  {
    id: "valeur-locative",
    category: "Tax",
    title: "Imputed rental value and real estate deductions",
    tags: ["real estate", "imputed rental value"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Owner-occupier: <strong>imputed rental value</strong> added to income (60 to 70% of theoretical rent).</li>
        <li>Deductions: mortgage interest, maintenance costs (flat rate 10 or 20% depending on age of the property, or actual costs).</li>
        <li>Value-adding works not deductible (except energy works in some cantons).</li>
        <li>National reform underway: imputed rental value may be abolished in the medium term.</li>
      </ul>
    ),
  },
  {
    id: "dirigeant",
    category: "Company director",
    title: "Salary vs dividend: two-level optimization",
    tags: ["director", "dividend", "LLC", "Plc"],
    body: (
      <>
        <p>For a director-shareholder, the salary/dividend trade-off plays on:</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li><strong>Salary</strong>: social charges (12.8% AHV/IV/EO employee + employer, BVG 7-18%), deductible at company level.</li>
          <li><strong>Dividend</strong>: no social charges but <strong>economic double taxation</strong> (corporate tax + private tax).</li>
          <li><strong>Privileged taxation</strong>: with participation ≥ 10%, dividends taxed at 50% (federal) and 50-70% (cantonal).</li>
          <li>Rule of thumb: cover BVG/AHV needs with a "realistic" salary, then take the surplus as a dividend.</li>
          <li>Watch out for the <strong>arm's-length salary</strong> challenged by AHV if too low (recovery + fine possible).</li>
        </ul>
      </>
    ),
  },
];

// =====================================================================
// IT · Italiano svizzero, terminologia ufficiale
// =====================================================================
const IT: WikiArticle[] = [
  {
    id: "demarrage",
    category: "Per iniziare",
    title: "Primi passi in SwissBroker Pro",
    tags: ["intro", "broker", "cliente"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Creare un cliente</strong>: menu Clienti → Nuovo cliente. Inserire identità, cantone, stato civile, stipendio.</li>
        <li><strong>Avviare un calcolo</strong>: dalla pratica cliente, scegliere un calcolatore nella barra laterale (precompilazione automatica).</li>
        <li><strong>Salvare</strong>: pulsante «Salva» in fondo a ogni calcolatore. Reperibile nello Storico.</li>
        <li><strong>Esportare</strong>: pulsante PDF per generare un rapporto pronto da inviare al cliente.</li>
        <li><strong>Modalità guidata</strong>: pulsante in alto a destra di ogni calcolatore. Visita interattiva dei campi.</li>
      </ul>
    ),
  },
  {
    id: "wiki-clients",
    category: "Per iniziare",
    title: "Pratica cliente: cosa inserire?",
    tags: ["cliente", "dati"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Cantone + comune</strong>: indispensabile per i moltiplicatori comunali e la tariffa cantonale/comunale.</li>
        <li><strong>Stato civile + confessione</strong>: incide sulla tariffa (coniugato = splitting parziale) e sull'imposta di culto.</li>
        <li><strong>Permesso</strong>: i permessi B / G fanno scattare l'imposta alla fonte.</li>
        <li><strong>Previdenza</strong>: averi LPP, potenziale di riscatto, conti 3a/3b. Utile per LPP, libero passaggio, pensionamento.</li>
        <li><strong>Patrimonio</strong>: immobili, titoli, conti. Utile per l'imposta sulla sostanza e il valore locativo.</li>
      </ul>
    ),
  },
  {
    id: "avs-base",
    category: "1° pilastro · AVS / AI",
    title: "Come funziona la rendita AVS",
    tags: ["AVS", "AI", "1° pilastro", "pensionamento"],
    body: (
      <>
        <p>La rendita AVS dipende da due parametri: il <strong>numero di anni di contribuzione</strong> (scala 44) e il <strong>reddito annuo medio determinante</strong>.</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>Obbligo contributivo dai 18 anni (con reddito) o 21 anni (senza reddito).</li>
          <li><strong>Scala 44</strong> = rendita completa. Ogni anno mancante = circa 1/44 di rendita persa.</li>
          <li><strong>Rendita minima 2026</strong>: 1'260 CHF/mese · <strong>massima</strong>: 2'520 CHF/mese (singolo).</li>
          <li><strong>Tetto coniugi</strong>: 150 % della rendita massima individuale (3'780 CHF).</li>
          <li>Accrediti per compiti educativi (figli &lt; 16 anni) e di assistenza aggiunti al reddito determinante.</li>
        </ul>
      </>
    ),
  },
  {
    id: "avs-anticipation",
    category: "1° pilastro · AVS / AI",
    title: "Anticipare o differire la rendita AVS",
    tags: ["AVS", "anticipazione", "differimento"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Anticipazione</strong> di 1 o 2 anni: riduzione definitiva del 6,8 % per anno anticipato.</li>
        <li><strong>Differimento</strong> di 1 a 5 anni: supplemento dal 5,2 % al 31,5 % a seconda della durata.</li>
        <li>I contributi restano dovuti fino all'età di riferimento anche in caso di anticipazione.</li>
        <li>Calcolo di redditività: confronto tra supplemento e speranza di vita residua.</li>
      </ul>
    ),
  },
  {
    id: "lpp-coordination",
    category: "2° pilastro · LPP & riscatti",
    title: "Salario coordinato e deduzione di coordinamento",
    tags: ["LPP", "salario coordinato"],
    body: (
      <>
        <p>Il <strong>salario coordinato</strong> è la base su cui la cassa pensione calcola gli accrediti di vecchiaia.</p>
        <p className="mt-2 font-mono text-xs bg-muted/50 p-2 rounded">salario coordinato = min(lordo; massimo assicurato 90'720) − deduzione 26'460</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>La deduzione si applica <strong>dopo</strong> il limite del salario massimo assicurato.</li>
          <li>Soglia d'entrata LPP 2026: 22'680 CHF/anno.</li>
          <li>Casse sovraobbligatorie (quadri, piani 1e) possono superare i 90'720.</li>
        </ul>
      </>
    ),
  },
  {
    id: "lpp-credits",
    category: "2° pilastro · LPP & riscatti",
    title: "Accrediti di vecchiaia per fascia d'età",
    tags: ["LPP", "accrediti"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>25 a 34 anni</strong>: 7 % del salario coordinato</li>
        <li><strong>35 a 44 anni</strong>: 10 %</li>
        <li><strong>45 a 54 anni</strong>: 15 %</li>
        <li><strong>55 a 65 anni</strong>: 18 %</li>
        <li>Versati 50/50 dipendente/datore di lavoro (minimo legale). Molte casse fanno di più sul lato datore.</li>
      </ul>
    ),
  },
  {
    id: "lpp-rachat",
    category: "2° pilastro · LPP & riscatti",
    title: "Riscatti LPP: leva fiscale importante",
    tags: ["LPP", "riscatto", "fiscalità"],
    body: (
      <>
        <p>Un riscatto è <strong>deducibile al 100 %</strong> dal reddito imponibile e capitalizzato nella cassa al tasso minimo LPP.</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li><strong>Blocco di 3 anni</strong>: il capitale riscattato non è prelevabile come capitale per 3 anni (altrimenti ripresa fiscale).</li>
          <li>Il <strong>potenziale di riscatto</strong> è indicato sul certificato LPP (differenza tra avere obiettivo e attuale).</li>
          <li>Conviene scaglionare su più anni per restare nella fascia marginale alta.</li>
          <li>Risparmio fiscale tipico: 25 - 40 % del riscatto secondo cantone e reddito.</li>
        </ul>
      </>
    ),
  },
  {
    id: "lpp-conversion",
    category: "2° pilastro · LPP & riscatti",
    title: "Aliquota di conversione: rendita vs capitale",
    tags: ["LPP", "conversione", "pensionamento"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
<li><strong>Aliquota applicata: 6,0 %</strong> (ipotesi prudente · aliquota legale minima 2026: 6,8 %, alcune casse applicano già 5,5 %).</li>
        <li>Capitale di 500'000 CHF × 6,0 % = 30'000 CHF di rendita annua vitalizia.</li>
        <li><strong>Rendita</strong>: sicurezza a vita + rendita per coniuge, ma imposta al 100 %.</li>
        <li><strong>Capitale</strong>: flessibilità + trasmissione agli eredi, ma imposto una volta (aliquota ridotta) poi sostanza imponibile.</li>
        <li>Mix 50/50 spesso ottimale. Decisione irrevocabile, in genere da annunciare 3 anni prima del pensionamento.</li>
      </ul>
    ),
  },
  {
    id: "p3a-base",
    category: "3° pilastro · A & B",
    title: "Pilastro 3a: massimali e regole",
    tags: ["3a", "deduzione", "fiscalità"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Salariato con LPP</strong>: 7'258 CHF/anno (2026), deducibile al 100 %.</li>
        <li><strong>Indipendente senza LPP</strong>: 20 % del reddito netto, max 36'288 CHF.</li>
        <li>Capitale bloccato fino a 5 anni prima dell'età di riferimento AVS.</li>
        <li>Imposto al prelievo a <strong>aliquota ridotta separata</strong> (in media 1/5 della tariffa ordinaria).</li>
        <li>Strategia: aprire 3 - 5 conti 3a e prelevarli in anni diversi per scaglionare l'imposta.</li>
      </ul>
    ),
  },
  {
    id: "simulations-multiples",
    category: "Sintesi & appuntamento",
    title: "Confrontare più situazioni con lo stesso calcolatore",
    tags: ["simulazione", "confronto", "sintesi"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Lo stesso calcolatore può essere <strong>salvato più volte</strong> per lo stesso cliente: salvarlo una prima volta «così com'è», poi modificare alcuni parametri (stato civile, cantone, riscatto LPP, ecc.) e salvare di nuovo.</li>
        <li>Ogni salvataggio crea una <strong>voce distinta</strong> nella cronologia del cliente, visibile in «Simulazioni collegate» sulla sua scheda.</li>
        <li>Utilità concreta: simulare «Situazione attuale» vs «Situazione dopo un cambiamento di vita» (matrimonio, nascita, trasloco, riscatto LPP) per lo stesso cliente.</li>
        <li>Entrambe le versioni possono poi essere <strong>selezionate insieme</strong> al momento di generare la sintesi PDF, così il cliente vede concretamente l'impatto del cambiamento.</li>
        <li>Dare a ogni simulazione un titolo chiaro (campo «Titolo» al momento del salvataggio) per distinguerle facilmente nella lista.</li>
      </ul>
    ),
  },
  {
    id: "synthese-pdf",
    category: "Sintesi & appuntamento",
    title: "Generare la sintesi PDF dell'appuntamento",
    tags: ["pdf", "sintesi", "appuntamento", "pagamento"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>La sintesi PDF si genera dalla scheda cliente, scheda «Sintesi appuntamento», una volta salvata almeno una simulazione.</li>
        <li>Tutte le simulazioni salvate per quel cliente appaiono in «Simulazioni collegate»: è possibile selezionarle <strong>tutte o solo alcune</strong>.</li>
        <li>La generazione del PDF è <strong>sbloccata dopo il pagamento</strong> dell'appuntamento da parte del cliente (minimo 80 CHF), tramite il pulsante «Fatturare questo appuntamento».</li>
        <li>Il PDF finale contiene: il profilo del cliente, una pagina per simulazione selezionata, una tabella comparativa prima/dopo, e una conclusione con raccomandazioni quantificate.</li>
        <li>Il nome dello studio, il logo e i contatti mostrati nel PDF provengono dal profilo del consulente («Il mio profilo»).</li>
      </ul>
    ),
  },
  {
    id: "profil-courtier-paiements",
    category: "Primi passi",
    title: "Completare il profilo consulente (pagamenti, conto bancario)",
    tags: ["profilo", "stripe", "pagamento", "iban"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Per fatturare un appuntamento e sbloccare le sintesi PDF, il consulente deve prima <strong>collegare il proprio conto bancario</strong> tramite Stripe Connect, da «Il mio profilo».</li>
        <li>Senza questo passaggio, ogni tentativo di fatturazione restituisce un errore chiaro.</li>
        <li>Una volta collegato, viene trattenuta automaticamente una commissione del 10%, il resto viene trasferito direttamente al consulente.</li>
        <li>Il profilo permette anche di personalizzare i report PDF: nome dello studio, logo, colori, nota a piè di pagina.</li>
      </ul>
    ),
  },
  {
    id: "p3b-base",
    category: "3° pilastro · A & B",
    title: "Pilastro 3b: assicurazione vita libera e risparmio",
    tags: ["3b", "risparmio libero"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Nessun massimale</strong>, capitale disponibile in ogni momento.</li>
        <li><strong>Nessuna deduzione</strong> dal reddito (eccetto cantoni GE e FR con tetti modesti).</li>
        <li>Prelievo <strong>generalmente esente</strong> dall'imposta sul reddito se contratto ≥ 5 anni e sottoscritto prima dei 66 anni.</li>
        <li>Capitale cumulato entra nella sostanza imponibile.</li>
        <li>Utile per: risparmiare oltre il 3a saturato, pianificare la successione, finanziare un progetto pre-pensionamento.</li>
      </ul>
    ),
  },
  {
    id: "frontaliers",
    category: "Frontalieri & imposta alla fonte",
    title: "Imposta alla fonte vs ordinaria",
    tags: ["fonte", "frontaliere", "TOU"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Permesso B/G + reddito &lt; 120'000</strong>: imposta alla fonte per impostazione predefinita (tariffa A/B/C secondo la situazione).</li>
        <li><strong>TOU (Tassazione ordinaria ulteriore)</strong>: possibilità di chiedere la tassazione ordinaria se ≥ 90 % del reddito mondiale è svizzero.</li>
        <li>Permette di dedurre 3a, riscatti LPP, interessi ipotecari, spese professionali effettive.</li>
        <li>Domanda da depositare entro il 31 marzo dell'anno successivo. Impegno irrevocabile per gli anni seguenti.</li>
        <li><strong>Frontalieri VD/GE</strong>: ritenuta del 4,5 % retrocessa alla Francia. Tassazione principale in Francia.</li>
      </ul>
    ),
  },
  {
    id: "ifd-icc",
    category: "Fiscalità",
    title: "IFD, ICC, moltiplicatori: la trinità fiscale",
    tags: ["IFD", "ICC", "comunale"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>IFD</strong> (Imposta federale diretta): tariffa unica nazionale, max 11,5 %.</li>
        <li><strong>ICC</strong> (Imposta cantonale e comunale): tariffa cantonale di base × coefficiente cantonale × moltiplicatore comunale.</li>
        <li>Esempio Vaud: tariffa × 154,5 (cantone) × 78 (Losanna) / 100.</li>
        <li><strong>Imposta di culto</strong>: aggiunta se confessione dichiarata (cattolica, protestante).</li>
        <li>Carico totale tipico: 18 - 35 % secondo cantone, comune e reddito.</li>
      </ul>
    ),
  },
  {
    id: "fortune",
    category: "Fiscalità",
    title: "Imposta sulla sostanza: base ed esenzioni",
    tags: ["sostanza", "patrimonio"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Base: tutti i beni (immobili al valore fiscale, conti, titoli, veicoli, 3b).</li>
        <li><strong>Esente</strong>: averi LPP e 3a finché non prelevati.</li>
        <li>Debiti (ipoteca, prestiti) deducibili al 100 %.</li>
        <li>Aliquota cantonale progressiva, in genere 0,1 - 0,7 % del netto.</li>
        <li>Scudo fiscale in alcuni cantoni (GE, VD): imposta totale ≤ 60 % del reddito.</li>
      </ul>
    ),
  },
  {
    id: "valeur-locative",
    category: "Fiscalità",
    title: "Valore locativo e deduzioni immobiliari",
    tags: ["immobili", "valore locativo"],
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Proprietario occupante: <strong>valore locativo</strong> aggiunto al reddito (60 - 70 % della pigione teorica).</li>
        <li>Deduzioni: interessi ipotecari, spese di manutenzione (forfait 10 o 20 % secondo l'età dell'immobile, o spese effettive).</li>
        <li>Lavori a valore aggiunto non deducibili (eccetto energetici in alcuni cantoni).</li>
        <li>Riforma nazionale in corso: il valore locativo potrebbe essere abolito a medio termine.</li>
      </ul>
    ),
  },
  {
    id: "dirigeant",
    category: "Dirigente di società",
    title: "Salario vs dividendo: ottimizzazione su due livelli",
    tags: ["dirigente", "dividendo", "Sagl", "SA"],
    body: (
      <>
        <p>Per un dirigente azionista, l'arbitraggio salario/dividendo agisce su:</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li><strong>Salario</strong>: oneri sociali (12,8 % AVS/AI/IPG dipendente + datore, LPP 7-18 %), deducibile per la società.</li>
          <li><strong>Dividendo</strong>: nessun onere sociale ma <strong>doppia imposizione economica</strong> (imposta società + imposta privato).</li>
          <li><strong>Imposizione privilegiata</strong>: con partecipazione ≥ 10 %, dividendi tassati al 50 % (federale) e 50-70 % (cantonale).</li>
          <li>Regola pratica: coprire il fabbisogno LPP/AVS con un salario «realistico», poi prelevare l'eccedenza come dividendo.</li>
          <li>Attenzione al <strong>salario d'uso</strong> contestato dall'AVS se troppo basso (ripresa + multa possibile).</li>
        </ul>
      </>
    ),
  },
];

const BY_LANG: Partial<Record<AppLanguage, WikiArticle[]>> = { fr: FR, de: DE, en: EN, it: IT };

export function getWikiArticles(lang: AppLanguage): WikiArticle[] {
  return BY_LANG[lang] ?? FR;
}

export function getWikiCategories(lang: AppLanguage): string[] {
  return Array.from(new Set(getWikiArticles(lang).map((a) => a.category)));
}
