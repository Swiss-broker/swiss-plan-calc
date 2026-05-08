// Articles wiki — multilingue. FR = source de vérité, DE = traduction officielle.
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
// FR — source de vérité
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
        <li><strong>Taux légal 2026</strong> : 6.8 % (en baisse continue, certaines caisses appliquent déjà 5.5 %).</li>
        <li>Capital de 500 000 CHF × 6.8 % = 34 000 CHF de rente annuelle viagère.</li>
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
];

// =====================================================================
// DE — Schweizerdeutsch (Hochdeutsch CH), Terminologie offiziell
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
        <li><strong>Gesetzlicher Satz 2026</strong>: 6.8 % (kontinuierlich sinkend, manche Kassen wenden bereits 5.5 % an).</li>
        <li>Kapital von 500'000 CHF × 6.8 % = 34'000 CHF lebenslange Jahresrente.</li>
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
];

const BY_LANG: Partial<Record<AppLanguage, WikiArticle[]>> = { fr: FR, de: DE };

export function getWikiArticles(lang: AppLanguage): WikiArticle[] {
  return BY_LANG[lang] ?? FR;
}

export function getWikiCategories(lang: AppLanguage): string[] {
  return Array.from(new Set(getWikiArticles(lang).map((a) => a.category)));
}
