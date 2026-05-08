// Dictionnaire allemand (Schweizerdeutsch — Hochdeutsch CH) · ÉTAPE 2.
// Terminologie officielle suisse : AHV/IV, BVG, Säule 3a/3b, Quellensteuer,
// Grenzgänger, ordentliche Besteuerung, NBU.
// Source de vérité : src/lib/i18n/fr.ts. Toute clé manquante retombe sur FR.

export const de: Record<string, string> = {
  // === Cantons (noms allemands officiels) ===
  "canton.GE": "Genf",
  "canton.VD": "Waadt",
  "canton.VS": "Wallis",
  "canton.FR": "Freiburg",
  "canton.NE": "Neuenburg",
  "canton.JU": "Jura",
  "canton.ZG": "Zug",

  // === Comparateur cantonal ===
  "comparator.scope.notice":
    "📍 Vergleich auf den 6 Westschweizer Kantonen + Zug (Referenz). 19 weitere Kantone in Kürze verfügbar.",
  "comparator.zg.badge": "Referenz für optimierte Steuern",
  "comparator.zg.tooltip":
    "Vergleich ausserhalb der Westschweiz — in v1 nicht als Wohnkanton verfügbar.",
  "comparator.section.romand": "Westschweizer Kantone",
  "comparator.section.reference": "Referenz ausserhalb der Westschweiz",

  // === Optimiseur · suggestions chiffrées ===
  "lpp.rachat.suggestion":
    "BVG-Einkaufspotenzial: {montant} CHF. Geschätzte Steuerersparnis bei Ihrem Grenzsteuersatz ({taux}%): {economie} CHF.",
  "canton.move.suggestion":
    "Wohnsitz in {ville} ({code}): geschätzte Ersparnis von {economie} CHF/Jahr gegenüber {actuel}.",

  // === Commun ===
  "common.year.short": "Jahr",
  "common.years.short": "Jahre",

  // === Boutons / actions génériques ===
  "common.save": "Speichern",
  "common.cancel": "Abbrechen",
  "common.confirm": "Bestätigen",
  "common.close": "Schliessen",
  "common.edit": "Bearbeiten",
  "common.delete": "Löschen",
  "common.archive": "Archivieren",
  "common.restore": "Wiederherstellen",
  "common.create": "Erstellen",
  "common.next": "Weiter",
  "common.previous": "Zurück",
  "common.back": "Zurück",
  "common.search": "Suchen",
  "common.loading": "Wird geladen…",
  "common.attach": "Verknüpfen",
  "common.detach": "Trennen",
  "common.add": "Hinzufügen",
  "common.remove": "Entfernen",
  "common.duplicate": "Duplizieren",
  "common.export": "Exportieren",
  "common.import": "Importieren",
  "common.share": "Teilen",
  "common.print": "Drucken",
  "common.optional": "Optional",
  "common.required": "Pflichtfeld",
  "common.yes": "Ja",
  "common.no": "Nein",
  "common.empty": "Keine Einträge",
  "common.error": "Fehler",
  "common.success": "Erfolg",

  // === Formulaires ===
  "form.first_name": "Vorname",
  "form.last_name": "Nachname",
  "form.date_of_birth": "Geburtsdatum",
  "form.gender": "Geschlecht",
  "form.email": "E-Mail",
  "form.phone": "Telefon",
  "form.civil_status": "Zivilstand",
  "form.confession": "Konfession",
  "form.nationality": "Nationalität",
  "form.permit": "Ausländerausweis",
  "form.tax_status": "Steuerstatus",
  "form.canton": "Kanton",
  "form.commune": "Gemeinde",
  "form.postal_code": "PLZ",
  "form.country_of_residence": "Wohnsitzland",
  "form.work_status": "Erwerbsstatus",
  "form.employer": "Arbeitgeber",
  "form.activity_rate": "Beschäftigungsgrad",
  "form.gross_annual_salary": "Bruttojahreslohn",
  "form.bonus": "Bonus",
  "form.spouse": "Ehepartner(in)",
  "form.children": "Kinder",
  "form.legal_form": "Rechtsform",
  "form.legal_name": "Firmenname",

  // === Navigation principale ===
  "nav.dashboard": "Übersicht",
  "nav.clients": "Kunden",
  "nav.companies": "Unternehmen",
  "nav.calculators": "Rechner",
  "nav.wiki": "Wiki & Schulung",
  "nav.history": "Verlauf",
  "nav.account": "Mein Profil",
  "nav.signout": "Abmelden",

  // === Sélecteur de langue ===
  "lang.label": "Sprache",
  "lang.fr": "Französisch",
  "lang.de": "Deutsch",
  "lang.en": "Englisch",
  "lang.it": "Italienisch",

  // === Calculateurs — titres + descriptions ===
  "calc.avs_ai.title": "1. Säule AHV/IV",
  "calc.avs_ai.desc":
    "Schätzung Einzel- oder Paarrente, AHV21, Plafonierung 3'780 CHF/Monat.",
  "calc.lpp.title": "2. Säule BVG & Einkäufe",
  "calc.lpp.desc":
    "Projektion Altersguthaben, gestaffelter Einkaufsplan, Steuerersparnis.",
  "calc.pillar3a.title": "Säule 3a & 3b",
  "calc.pillar3a.desc":
    "3a (abzugsfähig, Maximum 7'258 CHF) und 3b (frei, nicht abzugsfähig). Projektion und gestaffelter Bezug.",
  "calc.vested.title": "Freizügigkeit",
  "calc.vested.desc":
    "Strategien Sicherheit / Ausgewogen / Dynamisch, Nettoprojektion nach Gebühren und Steuern.",
  "calc.cross_border.title": "Grenzgänger FR / IT",
  "calc.cross_border.desc":
    "4.5%-Regime (8 Kantone), Sonderfall Genf, Italo-Schweizer Abkommen Tessin 2023.",
  "calc.income_tax.title": "Einkommens- & Vermögenssteuer",
  "calc.income_tax.desc":
    "DBSt + StG alle Kantone, Schweizer Standardabzüge, Grenz- & Effektivsatz.",
  "calc.source_tax.title": "Quellensteuer",
  "calc.source_tax.desc": "Tarife A / B / C / H 2026 + Grenzgänger Frankreich (4.5%).",
  "calc.tou.title": "NOV / Quasi-Ansässige",
  "calc.tou.desc":
    "90%-Berechtigung und Vergleich Quellensteuerabzug vs. nachträgliche ordentliche Veranlagung.",
  "calc.retirement.title": "Rente vs. Kapital",
  "calc.retirement.desc": "Vergleich BVG-Rente lebenslang oder Kapitalbezug + Anlage.",
  "calc.director.title": "Lohn / Dividende für Geschäftsführer",
  "calc.director.desc":
    "Vergütungsstrategien für GmbH/AG-Geschäftsführer: Lohn, Dividenden, Reserven.",
  "calc.canton_compare.title": "Kantonsvergleich",
  "calc.canton_compare.desc":
    "Vergleichen Sie Ihre Steuerlast in den 6 Westschweizer Kantonen (+ Zug als Referenz) auf einen Klick.",
  "calc.open": "Öffnen",

  // === Enums : gender ===
  "enum.gender.male": "Mann",
  "enum.gender.female": "Frau",
  "enum.gender.other": "Andere / Non-binär",

  // === Enums : civil_status ===
  "enum.civil_status.single": "Ledig",
  "enum.civil_status.married": "Verheiratet",
  "enum.civil_status.registered_partnership": "Eingetragene Partnerschaft",
  "enum.civil_status.divorced": "Geschieden",
  "enum.civil_status.widowed": "Verwitwet",
  "enum.civil_status.separated": "Getrennt",

  // === Enums : confession ===
  "enum.confession.none": "Konfessionslos",
  "enum.confession.roman_catholic": "Römisch-katholisch",
  "enum.confession.protestant": "Evangelisch-reformiert",
  "enum.confession.christian_catholic": "Christkatholisch",
  "enum.confession.jewish": "Israelitisch",
  "enum.confession.other": "Andere",

  // === Enums : permit ===
  "enum.permit.swiss": "Schweizer(in)",
  "enum.permit.C": "Ausweis C (Niederlassung)",
  "enum.permit.B": "Ausweis B (Aufenthalt)",
  "enum.permit.L": "Ausweis L (Kurzaufenthalt)",
  "enum.permit.Ci": "Ausweis Ci (Familiennachzug)",
  "enum.permit.F": "Ausweis F (vorläufig aufgenommen)",
  "enum.permit.G": "Ausweis G (Grenzgänger)",
  "enum.permit.none": "Keiner",

  // === Enums : tax_status ===
  "enum.tax_status.resident": "Ansässig — ordentliche Besteuerung",
  "enum.tax_status.source_taxed": "Quellenbesteuert (Ausweis B/L)",
  "enum.tax_status.cross_border_fr_1983":
    "Französische(r) Grenzgänger(in) — Abkommen 1983",
  "enum.tax_status.cross_border_ge": "Grenzgänger(in) Genf (Quellensteuer ordentlicher Tarif)",
  "enum.tax_status.tou": "NOV — Nachträgliche ordentliche Veranlagung",

  // === Enums : work_status ===
  "enum.work_status.employee": "Arbeitnehmer(in)",
  "enum.work_status.self_employed": "Selbstständig",
  "enum.work_status.director": "Geschäftsführer(in)",
  "enum.work_status.mixed": "Gemischt (angestellt + selbstständig)",
  "enum.work_status.retired": "Pensioniert",
  "enum.work_status.unemployed": "Erwerbslos",
  "enum.work_status.student": "Student(in)",

  // === Enums : lpp_plan ===
  "enum.lpp_plan.mandatory": "BVG obligatorisch",
  "enum.lpp_plan.extra_mandatory": "Überobligatorisch",
  "enum.lpp_plan.executive": "Kaderplan / 1e",
  "enum.lpp_plan.mixed": "Gemischt",

  // === Enums : legal_form (sociétés) ===
  "enum.legal_form.sarl": "GmbH",
  "enum.legal_form.sa": "AG",
  "enum.legal_form.raison_individuelle": "Einzelfirma",
  "enum.legal_form.snc": "Kollektivgesellschaft",
  "enum.legal_form.association": "Verein",
  "enum.legal_form.fondation": "Stiftung",

  // === Wiki ===
  "wiki.translation_pending":
    "📚 Dieser Inhalt ist derzeit nur auf Französisch verfügbar. Die Übersetzungen sind in Arbeit.",
  "wiki.title": "Wiki & Schulung",
  "wiki.subtitle":
    "Alle steuerlichen, sozialen und technischen Erklärungen, die in SwissBroker Pro verwendet werden. Suchen Sie per Stichwort oder stöbern Sie nach Thema.",
  "wiki.search.placeholder": "Suchen (BVG, Einkauf, Grenzgänger, Dividende…)",
  "wiki.all": "Alle ({count})",
  "wiki.empty": "Kein Artikel entspricht Ihrer Suche.",
  "wiki.quick.clients.title": "Ihre Kunden",
  "wiki.quick.clients.desc": "Erstellen, bearbeiten, archivieren",
  "wiki.quick.calculators.title": "Rechner",
  "wiki.quick.calculators.desc": "11 Fachmodule",
  "wiki.quick.companies.title": "Unternehmen",
  "wiki.quick.companies.desc": "Geschäftsführer & Dividenden",
  "wiki.footer": "Die angezeigten gesetzlichen Parameter (Maxima, Sätze, Tarife) sind für das Steuerjahr 2026 aktualisiert.",

  // === Dashboard ===
  "dash.greet.night": "Gute Nacht",
  "dash.greet.morning": "Guten Morgen",
  "dash.greet.afternoon": "Schönen Nachmittag",
  "dash.greet.evening": "Guten Abend",
  "dash.hello.suffix": "👋",
  "dash.subtitle": "Hier ist Ihr Cockpit für heute.",
  "dash.cta.new_client": "Neuer Kunde",
  "dash.cta.calculate": "Berechnen",
  "dash.level.title": "Berater-Level",
  "dash.level.value": "Stufe {n}",
  "dash.level.progress": "{current} / {target} Aktionen bis Stufe {next}",
  "dash.goal.title": "Monatsziel",
  "dash.goal.hint": "Simulationen in diesem Monat",
  "dash.tip.title": "Tipp des Tages",
  "dash.kpi.clients_active": "Aktive Kunden",
  "dash.kpi.clients_active.empty": "Starten Sie Ihr Portfolio",
  "dash.kpi.clients_active.archived": "{n} archiviert",
  "dash.kpi.companies": "Unternehmen",
  "dash.kpi.companies.hint": "Geschäftsführer & Dividenden",
  "dash.kpi.sims_month": "Simulationen diesen Monat",
  "dash.kpi.sims_month.total": "{n} insgesamt",
  "dash.kpi.calculators": "Rechner",
  "dash.kpi.calculators.hint": "11 Fachmodule",
  "dash.shortcuts.title": "Schnellzugriff auf Rechner",
  "dash.shortcuts.all": "Alle",
  "dash.shortcut.avs": "1. Säule · AHV/IV",
  "dash.shortcut.lpp": "2. Säule · BVG",
  "dash.shortcut.p3": "3. Säule · A & B",
  "dash.shortcut.cb": "Grenzgänger",
  "dash.recent.title": "Letzte Simulationen",
  "dash.recent.all": "Gesamter Verlauf",
  "dash.recent.empty.title": "Los geht's!",
  "dash.recent.empty.desc": "Starten Sie einen Rechner und klicken Sie auf «Speichern», um Ihre Simulationen hier wiederzufinden.",
  "dash.wiki.title": "Wiki & Schulung",
  "dash.wiki.desc": "Alle steuerlichen, sozialen und technischen Erklärungen. AHV, BVG, 3a/3b, Grenzgänger, Dividenden — alles an einem Ort.",
  "dash.wiki.cta": "Wiki öffnen",
  "dash.tip.1": "Ein BVG-Einkauf von 20 000 CHF spart je nach Kanton typischerweise 5 000 bis 8 000 CHF Steuern.",
  "dash.tip.2": "Mit 3 bis 5 Säule-3a-Konten lässt sich der Bezug auf mehrere Jahre staffeln und die Steuer halbieren bis dritteln.",
  "dash.tip.3": "Für Geschäftsführer mit ≥ 10 % Beteiligung werden Dividenden auf Bundesebene nur zu 50 % besteuert.",
  "dash.tip.4": "Die Steuerbremse begrenzt die Gesamtsteuer in Genf und Waadt auf 60 % des Einkommens.",
  "dash.tip.5": "Aufschub der AHV-Rente um 5 Jahre = +31.5 % lebenslange Rente. Lohnt sich bei Lebenserwartung > 13 Jahren nach 65.",
  "dash.tip.6": "Der BVG-Koordinationsabzug wird NACH der Plafonierung auf den max. versicherten Lohn (90 720 CHF) angewendet.",
  "dash.fallback.broker": "Berater(in)",

  // === Mein Profil ===
  "account.title": "Mein Profil",
  "account.subtitle": "Diese Informationen erscheinen auf den für Ihre Kunden generierten PDF-Berichten.",
  "account.brokerage_name": "Name des Maklerbüros",
  "account.default_canton": "Standard-Kanton",
  "account.default_canton.none": "keiner",
  "account.default_canton.out_of_scope": "(nicht in v1 verfügbar)",
  "account.default_canton.warning": "Dieser Kanton ist in v1 nicht verfügbar (Westschweiz). Wählen Sie einen Westschweizer Kanton, um die Berechnungen zu aktivieren.",
  "account.save": "Speichern",
  "account.toast.load_error": "Profil konnte nicht geladen werden",
  "account.toast.save_error": "Speichern fehlgeschlagen",
  "account.toast.save_success": "Profil aktualisiert",
};
