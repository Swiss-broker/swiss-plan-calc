import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Calculator,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Building2,
  Globe2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SwissBroker Pro — Calculateur prévoyance & fiscalité suisse" },
      {
        name: "description",
        content:
          "Plateforme professionnelle pour courtiers suisses : impôts, LPP, 3e pilier, frontaliers, optimisation fiscale et simulations multi-scénarios sur les 26 cantons.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <Features />
      <Modules />
      <Optimization />
      <CTASection />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-elegant">
            <span className="text-lg font-bold text-primary-foreground">S</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">
            SwissBroker <span className="text-primary">Pro</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">
            Fonctionnalités
          </a>
          <a href="#modules" className="text-sm text-muted-foreground hover:text-foreground">
            Modules
          </a>
          <a href="#optimisation" className="text-sm text-muted-foreground hover:text-foreground">
            Optimisation
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/auth">
            <Button variant="ghost" size="sm">
              Se connecter
            </Button>
          </Link>
          <Link to="/auth" search={{ mode: "signup" }}>
            <Button size="sm" className="shadow-elegant">
              Essayer gratuitement
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-hero">
      <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Conçu pour les courtiers suisses · 26 cantons · Frontaliers inclus
          </div>
          <h1 className="text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Le calculateur de référence pour la{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              prévoyance suisse
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            Impôts, 2e pilier, 3e pilier, frontaliers, retraite, rachats LPP, projections de
            placement. Des chiffres exacts, des scénarios comparés en un clic, des suggestions
            d'optimisation contextuelles pour chaque client.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="lg" className="h-12 px-8 shadow-elegant">
                Créer mon compte gratuit
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <a href="#modules">
              <Button size="lg" variant="outline" className="h-12 px-8">
                Voir les modules
              </Button>
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              Gratuit en v1
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              Sans carte bancaire
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              Données chiffrées et privées
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: Calculator,
      title: "Calculs exacts",
      desc: "Barèmes officiels IFD et ICC pour les 26 cantons, multiplicateurs communaux, impôt à la source A/B/C/H, frontaliers.",
    },
    {
      icon: TrendingUp,
      title: "Projections temps réel",
      desc: "Capital LPP, économie 3a, rendement composé, comparatif rente vs capital — résultats instantanés.",
    },
    {
      icon: Sparkles,
      title: "Optimisations suggérées",
      desc: "Recommandations chiffrées et contextuelles selon la situation du client (rachat LPP, fragmentation 3a, déménagement…).",
    },
    {
      icon: ShieldCheck,
      title: "Dossiers privés",
      desc: "Chaque courtier a son espace privé. Données chiffrées, aucun partage, conforme aux pratiques suisses.",
    },
  ];
  return (
    <section id="features" className="border-t border-border/50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Précision suisse, design 2026
          </h2>
          <p className="mt-4 text-muted-foreground">
            Un outil pensé pour les rendez-vous client : rapide, lisible, responsive — du
            smartphone au grand écran.
          </p>
        </div>
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it) => (
            <div
              key={it.title}
              className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <it.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">{it.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Modules() {
  const modules = [
    {
      tag: "Fiscalité",
      title: "Impôts revenu & fortune",
      desc: "IFD + ICC + multiplicateur communal + impôt ecclésiastique. Toutes les déductions admises (frais pro, primes, intérêts, garde, 3a, rachats LPP).",
    },
    {
      tag: "Source",
      title: "Impôt à la source & frontaliers",
      desc: "Barèmes A/B/C/H par canton, accord France-Suisse 4,5 %, régime genevois, quasi-résident et TOU avec recommandation.",
    },
    {
      tag: "2e pilier",
      title: "LPP — rachats, retraite, libre passage",
      desc: "Lacune de prévoyance, étalement optimal des rachats, comparatif rente / capital / mixte, impôt sur prestation en capital, projection libre passage.",
    },
    {
      tag: "3e pilier",
      title: "3a / 3b avec retrait échelonné",
      desc: "Plafonds salarié et indépendant, économie fiscale au taux marginal, projection rendement, fragmentation optimale en plusieurs comptes.",
    },
    {
      tag: "Scénarios",
      title: "Avant / après changement de vie",
      desc: "Mariage, naissance, déménagement intercantonal, achat immobilier, départ retraite — comparatif chiffré côte à côte.",
    },
    {
      tag: "Comparateur",
      title: "Classement des 26 cantons",
      desc: "Pour un profil client donné, voir le classement exact des cantons les plus avantageux.",
    },
  ];
  return (
    <section id="modules" className="border-t border-border/50 bg-muted/30 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Tout ce qui se calcule en Suisse
          </h2>
          <p className="mt-4 text-muted-foreground">
            Un moteur de calcul exhaustif. Les chiffres sont basés sur les barèmes officiels et
            mis à jour chaque année fiscale.
          </p>
        </div>
        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <div
              key={m.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-card"
            >
              <div className="mb-3 inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {m.tag}
              </div>
              <h3 className="text-lg font-semibold">{m.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Optimization() {
  return (
    <section id="optimisation" className="border-t border-border/50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
              <Sparkles className="h-3 w-3 text-primary" /> Différenciateur
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Suggestions d'optimisation contextuelles
            </h2>
            <p className="mt-4 text-muted-foreground">
              L'outil analyse automatiquement la situation du client et affiche les actions à
              valeur ajoutée — chiffrées, justifiées, prêtes à présenter.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              <Bullet>
                Capacité de rachat LPP détectée et étalée pour maximiser l'économie d'impôt.
              </Bullet>
              <Bullet>
                Versement 3a complémentaire chiffré au taux marginal exact du client.
              </Bullet>
              <Bullet>
                Stratégie de retrait LPP / 3a fragmentée pour casser la progressivité.
              </Bullet>
              <Bullet>
                Comparatif IS retenue vs TOU (taxation ordinaire ultérieure) pour quasi-résidents.
              </Bullet>
              <Bullet>
                Impact d'un déménagement intercantonal estimé à revenu constant.
              </Bullet>
            </ul>
          </div>
          <div className="relative">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Optimisations détectées</span>
              </div>
              <div className="space-y-3">
                <SuggestionCard
                  title="Rachat LPP recommandé"
                  amount="+ CHF 15'104 d'économie"
                  desc="Lacune disponible : 47'200. Étalement sur 3 ans pour optimiser le palier de progression."
                />
                <SuggestionCard
                  title="Versement 3a complémentaire"
                  amount="+ CHF 790 d'économie cette année"
                  desc="Versé : 4'800 / Plafond : 7'258. Compléter le maximum déductible."
                />
                <SuggestionCard
                  title="Fragmentation du retrait LPP"
                  amount="+ CHF 24'000 d'économie au départ retraite"
                  desc="Étaler le retrait sur 3 ans + 2 comptes 3a séparés."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      <span>{children}</span>
    </li>
  );
}

function SuggestionCard({
  title,
  amount,
  desc,
}: {
  title: string;
  amount: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="text-sm font-medium">{title}</div>
        <div className="shrink-0 rounded-md bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
          {amount}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function CTASection() {
  return (
    <section className="border-t border-border/50 py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-primary p-12 text-center shadow-elegant">
          <div className="absolute inset-0 grid-bg opacity-20" aria-hidden />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
              Prêt à optimiser vos rendez-vous client ?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/90">
              Inscription en 30 secondes. Aucune carte bancaire. Tout est gratuit pendant la
              phase de lancement.
            </p>
            <Link to="/auth" search={{ mode: "signup" }} className="mt-8 inline-block">
              <Button
                size="lg"
                variant="secondary"
                className="h-12 px-8 text-foreground shadow-card"
              >
                Créer mon compte courtier
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/50 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          SwissBroker Pro · Conçu en Suisse
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe2 className="h-3.5 w-3.5" />
          26 cantons · Frontaliers FR / IT / DE / AT
        </div>
      </div>
    </footer>
  );
}
