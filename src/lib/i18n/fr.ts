// Dictionnaire français — source de vérité.
// Toute clé manquante dans une autre langue retombe ici via le fallback de t().

export const fr: Record<string, string> = {
  // === Cantons ===
  "canton.GE": "Genève",
  "canton.VD": "Vaud",
  "canton.VS": "Valais",
  "canton.FR": "Fribourg",
  "canton.NE": "Neuchâtel",
  "canton.JU": "Jura",
  "canton.ZG": "Zoug",

  // === Comparateur cantonal ===
  "comparator.scope.notice":
    "📍 Comparaison sur les 6 cantons romands + Zoug (référence). 19 autres cantons disponibles prochainement.",
  "comparator.zg.badge": "Référence fiscalité optimisée",
  "comparator.zg.tooltip":
    "Comparaison hors Suisse romande — non disponible comme canton de domicile en v1.",
  "comparator.section.romand": "Cantons romands",
  "comparator.section.reference": "Référence hors Suisse romande",

  // === Optimiseur · suggestions chiffrées ===
  "lpp.rachat.suggestion":
    "Capacité de rachat LPP : {montant} CHF. Économie estimée à votre taux marginal ({taux}%) : {economie} CHF.",
  "canton.move.suggestion":
    "Domicile à {ville} ({code}) : économie estimée de {economie} CHF/an par rapport à {actuel}.",

  // === Commun ===
  "common.year.short": "an",
  "common.years.short": "ans",

  // === Boutons / actions génériques ===
  "common.save": "Sauvegarder",
  "common.cancel": "Annuler",
  "common.confirm": "Confirmer",
  "common.close": "Fermer",
  "common.edit": "Modifier",
  "common.delete": "Supprimer",
  "common.archive": "Archiver",
  "common.restore": "Restaurer",
  "common.create": "Créer",
  "common.next": "Suivant",
  "common.previous": "Précédent",
  "common.back": "Retour",
  "common.search": "Rechercher",
  "common.loading": "Chargement…",
  "common.attach": "Rattacher",
  "common.detach": "Détacher",
  "common.add": "Ajouter",
  "common.remove": "Retirer",
  "common.duplicate": "Dupliquer",
  "common.export": "Exporter",
  "common.import": "Importer",
  "common.share": "Partager",
  "common.print": "Imprimer",
  "common.optional": "Optionnel",
  "common.required": "Requis",
  "common.yes": "Oui",
  "common.no": "Non",
  "common.empty": "Aucun élément",
  "common.error": "Erreur",
  "common.success": "Succès",

  // === Formulaires ===
  "form.first_name": "Prénom",
  "form.last_name": "Nom",
  "form.date_of_birth": "Date de naissance",
  "form.gender": "Sexe",
  "form.email": "Email",
  "form.phone": "Téléphone",
  "form.civil_status": "État civil",
  "form.confession": "Confession",
  "form.nationality": "Nationalité",
  "form.permit": "Permis",
  "form.tax_status": "Statut fiscal",
  "form.canton": "Canton",
  "form.commune": "Commune",
  "form.postal_code": "NPA",
  "form.country_of_residence": "Pays de résidence",
  "form.work_status": "Statut professionnel",
  "form.employer": "Employeur",
  "form.activity_rate": "Taux d'activité",
  "form.gross_annual_salary": "Salaire annuel brut",
  "form.bonus": "Bonus",
  "form.spouse": "Conjoint(e)",
  "form.children": "Enfants",
  "form.legal_form": "Forme juridique",
  "form.legal_name": "Raison sociale",

  // === Navigation principale ===
  "nav.dashboard": "Tableau de bord",
  "nav.clients": "Clients",
  "nav.companies": "Sociétés",
  "nav.calculators": "Calculateurs",
  "nav.wiki": "Wiki & formation",
  "nav.history": "Historique",
  "nav.account": "Mon profil",
  "nav.signout": "Se déconnecter",

  // === Sélecteur de langue ===
  "lang.label": "Langue",
  "lang.fr": "Français",
  "lang.de": "Deutsch",
  "lang.en": "English",
  "lang.it": "Italiano",

  // === Calculateurs — titres + descriptions ===
  "calc.avs_ai.title": "1er pilier AVS/AI",
  "calc.avs_ai.desc":
    "Estimation rente individuelle ou couple, AVS21, plafonnement 3'780 CHF/mois.",
  "calc.lpp.title": "2e pilier LPP & rachats",
  "calc.lpp.desc":
    "Projection capital retraite, plan de rachat étalé, économie fiscale.",
  "calc.pillar3a.title": "3e pilier A & B",
  "calc.pillar3a.desc":
    "3a (déductible, plafond 7'258 CHF) et 3b (libre, non déductible). Projection et retrait étalé.",
  "calc.vested.title": "Libre passage",
  "calc.vested.desc":
    "Stratégies sécurité / équilibre / dynamique, projection nette frais et impôts.",
  "calc.cross_border.title": "Frontaliers FR / IT",
  "calc.cross_border.desc":
    "Régime 4.5 % (8 cantons), Genève spécifique, accord italo-suisse Tessin 2023.",
  "calc.income_tax.title": "Impôt revenu & fortune",
  "calc.income_tax.desc":
    "IFD + ICC tous cantons, déductions standard suisses, taux marginal & effectif.",
  "calc.source_tax.title": "Impôt à la source",
  "calc.source_tax.desc": "Barèmes A / B / C / H 2026 + frontaliers France (4.5 %).",
  "calc.tou.title": "TOU / quasi-résident",
  "calc.tou.desc":
    "Éligibilité 90 % et comparatif IS retenue vs taxation ordinaire ultérieure.",
  "calc.retirement.title": "Rente vs capital",
  "calc.retirement.desc": "Compare rente LPP à vie ou retrait en capital + placement.",
  "calc.director.title": "Salaire / dividende dirigeant",
  "calc.director.desc":
    "Comparateur de stratégies de rémunération pour dirigeants Sàrl/SA : salaire, dividendes, réserves.",
  "calc.canton_compare.title": "Comparateur cantonal",
  "calc.canton_compare.desc":
    "Compare votre charge fiscale dans les 6 cantons romands (+ Zoug en référence) en un clic.",
  "calc.open": "Ouvrir",

  // === Enums : gender ===
  "enum.gender.male": "Homme",
  "enum.gender.female": "Femme",
  "enum.gender.other": "Autre / Non binaire",

  // === Enums : civil_status ===
  "enum.civil_status.single": "Célibataire",
  "enum.civil_status.married": "Marié(e)",
  "enum.civil_status.registered_partnership": "Partenariat enregistré",
  "enum.civil_status.divorced": "Divorcé(e)",
  "enum.civil_status.widowed": "Veuf / Veuve",
  "enum.civil_status.separated": "Séparé(e)",

  // === Enums : confession ===
  "enum.confession.none": "Sans confession",
  "enum.confession.roman_catholic": "Catholique romain",
  "enum.confession.protestant": "Protestant / Réformé",
  "enum.confession.christian_catholic": "Catholique chrétien",
  "enum.confession.jewish": "Israélite",
  "enum.confession.other": "Autre",

  // === Enums : permit ===
  "enum.permit.swiss": "Suisse",
  "enum.permit.C": "Permis C (établissement)",
  "enum.permit.B": "Permis B (séjour)",
  "enum.permit.L": "Permis L (courte durée)",
  "enum.permit.Ci": "Permis Ci (regroupement)",
  "enum.permit.F": "Permis F (admission provisoire)",
  "enum.permit.G": "Permis G (frontalier)",
  "enum.permit.none": "Aucun",

  // === Enums : tax_status ===
  "enum.tax_status.resident": "Résident(e) — taxation ordinaire",
  "enum.tax_status.source_taxed": "Imposé(e) à la source (permis B/L)",
  "enum.tax_status.cross_border_fr_1983": "Frontalier(ère) français(e) — accord 1983",
  "enum.tax_status.cross_border_ge": "Frontalier(ère) Genève (IS au barème normal)",
  "enum.tax_status.tou": "TOU — Taxation Ordinaire Ultérieure",

  // === Enums : work_status ===
  "enum.work_status.employee": "Salarié",
  "enum.work_status.self_employed": "Indépendant",
  "enum.work_status.director": "Dirigeant de société",
  "enum.work_status.mixed": "Mixte (salarié + indépendant)",
  "enum.work_status.retired": "Retraité",
  "enum.work_status.unemployed": "Sans emploi",
  "enum.work_status.student": "Étudiant",

  // === Enums : lpp_plan ===
  "enum.lpp_plan.mandatory": "LPP obligatoire",
  "enum.lpp_plan.extra_mandatory": "Sur-obligatoire",
  "enum.lpp_plan.executive": "Plan cadres / 1e",
  "enum.lpp_plan.mixed": "Mixte",

  // === Enums : legal_form (sociétés) ===
  "enum.legal_form.sarl": "Sàrl",
  "enum.legal_form.sa": "SA",
  "enum.legal_form.raison_individuelle": "Raison individuelle",
  "enum.legal_form.snc": "SNC",
  "enum.legal_form.association": "Association",
  "enum.legal_form.fondation": "Fondation",

  // === Wiki ===
  "wiki.translation_pending":
    "📚 Ce contenu n'est actuellement disponible qu'en français. Les traductions sont en cours.",
  "wiki.title": "Wiki & formation",
  "wiki.subtitle":
    "Toutes les explications fiscales, sociales et techniques utilisées dans SwissBroker Pro. Cherchez par mot-clé ou parcourez par thème.",
  "wiki.search.placeholder": "Rechercher (LPP, rachat, frontalier, dividende…)",
  "wiki.all": "Toutes ({count})",
  "wiki.empty": "Aucun article ne correspond à votre recherche.",
  "wiki.quick.clients.title": "Vos clients",
  "wiki.quick.clients.desc": "Créer, modifier, archiver",
  "wiki.quick.calculators.title": "Calculateurs",
  "wiki.quick.calculators.desc": "11 modules métier",
  "wiki.quick.companies.title": "Sociétés",
  "wiki.quick.companies.desc": "Dirigeants & dividendes",
  "wiki.footer": "Les paramètres légaux affichés (plafonds, taux, barèmes) sont mis à jour pour l'année fiscale 2026.",

  // === Dashboard ===
  "dash.greet.night": "Bonne nuit",
  "dash.greet.morning": "Bonjour",
  "dash.greet.afternoon": "Bel après-midi",
  "dash.greet.evening": "Bonsoir",
  "dash.hello.suffix": "👋",
  "dash.subtitle": "Voici votre cockpit du jour.",
  "dash.cta.new_client": "Nouveau client",
  "dash.cta.calculate": "Calculer",
  "dash.level.title": "Niveau courtier",
  "dash.level.value": "Niveau {n}",
  "dash.level.progress": "{current} / {target} actions vers le niveau {next}",
  "dash.goal.title": "Objectif du mois",
  "dash.goal.hint": "simulations effectuées ce mois",
  "dash.tip.title": "Astuce du jour",
  "dash.kpi.clients_active": "Clients actifs",
  "dash.kpi.clients_active.empty": "Démarrez votre portefeuille",
  "dash.kpi.clients_active.archived": "{n} archivé(s)",
  "dash.kpi.companies": "Sociétés",
  "dash.kpi.companies.hint": "Dirigeants & dividendes",
  "dash.kpi.sims_month": "Simulations ce mois",
  "dash.kpi.sims_month.total": "{n} au total",
  "dash.kpi.calculators": "Calculateurs",
  "dash.kpi.calculators.hint": "11 modules métier",
  "dash.shortcuts.title": "Accès rapide aux calculateurs",
  "dash.shortcuts.all": "Tous",
  "dash.shortcut.avs": "1er pilier · AVS/AI",
  "dash.shortcut.lpp": "2e pilier · LPP",
  "dash.shortcut.p3": "3e pilier · A & B",
  "dash.shortcut.cb": "Frontaliers",
  "dash.recent.title": "Dernières simulations",
  "dash.recent.all": "Tout l'historique",
  "dash.recent.empty.title": "C'est parti !",
  "dash.recent.empty.desc": "Lancez un calculateur et cliquez sur « Sauvegarder » pour retrouver vos simulations ici.",
  "dash.wiki.title": "Wiki & formation",
  "dash.wiki.desc": "Toutes les explications fiscales, sociales et techniques. AVS, LPP, 3a/3b, frontaliers, dividendes : pour ne plus rien chercher ailleurs.",
  "dash.wiki.cta": "Ouvrir le wiki",
  "dash.tip.1": "Un rachat LPP de 20 000 CHF économise typiquement 5 000 à 8 000 CHF d'impôts selon le canton.",
  "dash.tip.2": "Ouvrir 3 à 5 comptes 3a permet d'éclater le retrait sur plusieurs années et de diviser l'impôt par 2 ou 3.",
  "dash.tip.3": "Pour un dirigeant détenant ≥ 10 % de sa société, les dividendes sont taxés à seulement 50 % au fédéral.",
  "dash.tip.4": "Le bouclier fiscal limite l'impôt total à 60 % du revenu dans les cantons de Genève et Vaud.",
  "dash.tip.5": "Différer la rente AVS de 5 ans = +31.5 % de rente à vie. Rentable si espérance de vie > 13 ans après 65.",
  "dash.tip.6": "La déduction de coordination LPP s'applique APRÈS plafonnement au salaire assuré max (90 720 CHF).",
  "dash.fallback.broker": "courtier",

  // === Mon profil ===
  "account.title": "Mon profil",
  "account.subtitle": "Ces informations apparaissent sur les rapports PDF générés pour vos clients.",
  "account.brokerage_name": "Nom du cabinet",
  "account.default_canton": "Canton par défaut",
  "account.default_canton.none": "aucun",
  "account.default_canton.out_of_scope": "(hors scope v1)",
  "account.default_canton.warning": "Ce canton n'est pas disponible en v1 (Suisse romande). Sélectionnez un canton romand pour activer les calculs.",
  "account.save": "Enregistrer",
  "account.toast.load_error": "Impossible de charger votre profil",
  "account.toast.save_error": "Échec de l'enregistrement",
  "account.toast.save_success": "Profil mis à jour",
};
