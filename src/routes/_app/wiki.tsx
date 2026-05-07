import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  BookOpen,
  Search,
  Calculator,
  Users,
  Building2,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

const searchSchema = z.object({
  article: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/_app/wiki")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Wiki & formation · SwissBroker Pro" }] }),
  component: WikiPage,
});

type Article = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  body: React.ReactNode;
};

const ARTICLES: Article[] = [
  // ============ PRISE EN MAIN ============
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

  // ============ 1ER PILIER ============
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

  // ============ 2EME PILIER ============
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

  // ============ 3EME PILIER ============
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

  // ============ FRONTALIERS ============
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

  // ============ FISCALITÉ ============
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

  // ============ DIRIGEANT ============
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

const CATEGORIES = Array.from(new Set(ARTICLES.map((a) => a.category)));

function WikiPage() {
  const { article: targetArticle } = Route.useSearch();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [openItems, setOpenItems] = useState<string[]>([]);

  // Quand on arrive avec ?article=xxx, ouvrir + scroller automatiquement
  useEffect(() => {
    if (!targetArticle) return;
    const found = ARTICLES.find((a) => a.id === targetArticle);
    if (!found) return;
    setCat(null);
    setQ("");
    setOpenItems((prev) => (prev.includes(targetArticle) ? prev : [...prev, targetArticle]));
    // Scroll après render
    const t = setTimeout(() => {
      const el = document.getElementById(`wiki-${targetArticle}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary", "rounded-xl");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary", "rounded-xl"), 2200);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [targetArticle]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return ARTICLES.filter((a) => {
      if (cat && a.category !== cat) return false;
      if (!t) return true;
      return (
        a.title.toLowerCase().includes(t) ||
        a.tags.some((tag) => tag.toLowerCase().includes(t)) ||
        a.category.toLowerCase().includes(t)
      );
    });
  }, [q, cat]);

  const grouped = useMemo(() => {
    const m = new Map<string, Article[]>();
    for (const a of filtered) {
      if (!m.has(a.category)) m.set(a.category, []);
      m.get(a.category)!.push(a);
    }
    return m;
  }, [filtered]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-card">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Wiki & formation</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Toutes les explications fiscales, sociales et techniques utilisées dans
              SwissBroker Pro. Cherchez par mot-clé ou parcourez par thème.
            </p>
          </div>
        </div>

        <div className="mt-5 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher (LPP, rachat, frontalier, dividende…)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 h-11 text-sm"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <CategoryChip active={cat === null} onClick={() => setCat(null)}>
            Toutes ({ARTICLES.length})
          </CategoryChip>
          {CATEGORIES.map((c) => (
            <CategoryChip key={c} active={cat === c} onClick={() => setCat(c === cat ? null : c)}>
              {c}
            </CategoryChip>
          ))}
        </div>
      </div>

      {grouped.size === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Aucun article ne correspond à votre recherche.
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                {category}
              </h2>
              <div className="rounded-2xl border border-border bg-card shadow-card">
                <Accordion type="multiple" className="w-full">
                  {items.map((a) => (
                    <AccordionItem key={a.id} value={a.id} className="border-b last:border-0 px-4">
                      <AccordionTrigger className="text-sm font-medium hover:no-underline">
                        <div className="flex items-center gap-2 text-left">
                          <ChevronRight className="h-3.5 w-3.5 text-primary" />
                          {a.title}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed pl-6">
                        {a.body}
                        <div className="mt-3 flex flex-wrap gap-1">
                          {a.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px]">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <QuickCard to="/clients" icon={Users} title="Vos clients" desc="Créer, modifier, archiver" />
        <QuickCard to="/calculators" icon={Calculator} title="Calculateurs" desc="11 modules métier" />
        <QuickCard to="/companies" icon={Building2} title="Sociétés" desc="Dirigeants & dividendes" />
      </div>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        <Sparkles className="inline h-3 w-3" /> Les paramètres légaux affichés (plafonds,
        taux, barèmes) sont mis à jour pour l'année fiscale 2026.
      </p>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
        (active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted text-muted-foreground hover:bg-muted/70")
      }
    >
      {children}
    </button>
  );
}

function QuickCard({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: "/clients" | "/calculators" | "/companies";
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
    </Link>
  );
}
