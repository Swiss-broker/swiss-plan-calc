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
import { useT } from "@/contexts/LanguageContext";
import { PublicLanguageSwitcher } from "@/components/common/PublicLanguageSwitcher";
import { t as tStatic } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: tStatic("landing.head.title") },
      { name: "description", content: tStatic("landing.head.desc") },
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
  const t = useT();
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-elegant">
            <span className="text-lg font-bold text-primary-foreground">S</span>
          </div>
          <span className="truncate text-base font-semibold tracking-tight sm:text-lg">
            SwissBroker <span className="text-primary">Pro</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">
            {t("landing.nav.features")}
          </a>
          <a href="#modules" className="text-sm text-muted-foreground hover:text-foreground">
            {t("landing.nav.modules")}
          </a>
          <a href="#optimisation" className="text-sm text-muted-foreground hover:text-foreground">
            {t("landing.nav.optimization")}
          </a>
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <PublicLanguageSwitcher />
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="px-2 sm:px-3">
              {t("landing.cta.signin")}
            </Button>
          </Link>
          <Link to="/auth" search={{ mode: "signup" }}>
            <Button size="sm" className="shadow-elegant">
              <span className="hidden sm:inline">{t("landing.cta.try")}</span>
              <span className="sm:hidden">{t("landing.cta.try_short")}</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const t = useT();
  return (
    <section className="relative overflow-hidden bg-hero">
      <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t("landing.hero.badge")}
          </div>
          <h1 className="text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            {t("landing.hero.title.prefix")}{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              {t("landing.hero.title.highlight")}
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            {t("landing.hero.subtitle")}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="lg" className="h-12 px-8 shadow-elegant">
                {t("landing.hero.cta.signup")}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <a href="#modules">
              <Button size="lg" variant="outline" className="h-12 px-8">
                {t("landing.hero.cta.modules")}
              </Button>
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              {t("landing.hero.check.free")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              {t("landing.hero.check.no_card")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              {t("landing.hero.check.private")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const t = useT();
  const items = [
    { icon: Calculator, title: t("landing.feature.exact.title"), desc: t("landing.feature.exact.desc") },
    { icon: TrendingUp, title: t("landing.feature.proj.title"), desc: t("landing.feature.proj.desc") },
    { icon: Sparkles, title: t("landing.feature.opt.title"), desc: t("landing.feature.opt.desc") },
    { icon: ShieldCheck, title: t("landing.feature.priv.title"), desc: t("landing.feature.priv.desc") },
  ];
  return (
    <section id="features" className="border-t border-border/50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.features.title")}</h2>
          <p className="mt-4 text-muted-foreground">{t("landing.features.subtitle")}</p>
        </div>
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it) => (
            <div key={it.title} className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elegant">
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
  const t = useT();
  const modules = [
    { tag: t("landing.module.tax.tag"), title: t("landing.module.tax.title"), desc: t("landing.module.tax.desc") },
    { tag: t("landing.module.source.tag"), title: t("landing.module.source.title"), desc: t("landing.module.source.desc") },
    { tag: t("landing.module.lpp.tag"), title: t("landing.module.lpp.title"), desc: t("landing.module.lpp.desc") },
    { tag: t("landing.module.p3.tag"), title: t("landing.module.p3.title"), desc: t("landing.module.p3.desc") },
    { tag: t("landing.module.scen.tag"), title: t("landing.module.scen.title"), desc: t("landing.module.scen.desc") },
    { tag: t("landing.module.cmp.tag"), title: t("landing.module.cmp.title"), desc: t("landing.module.cmp.desc") },
  ];
  return (
    <section id="modules" className="border-t border-border/50 bg-muted/30 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.modules.title")}</h2>
          <p className="mt-4 text-muted-foreground">{t("landing.modules.subtitle")}</p>
        </div>
        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <div key={m.title} className="rounded-2xl border border-border bg-card p-6 shadow-card">
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
  const t = useT();
  return (
    <section id="optimisation" className="border-t border-border/50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
              <Sparkles className="h-3 w-3 text-primary" /> {t("landing.opt.badge")}
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.opt.title")}</h2>
            <p className="mt-4 text-muted-foreground">{t("landing.opt.desc")}</p>
            <ul className="mt-6 space-y-3 text-sm">
              <Bullet>{t("landing.opt.b1")}</Bullet>
              <Bullet>{t("landing.opt.b2")}</Bullet>
              <Bullet>{t("landing.opt.b3")}</Bullet>
              <Bullet>{t("landing.opt.b4")}</Bullet>
              <Bullet>{t("landing.opt.b5")}</Bullet>
            </ul>
          </div>
          <div className="relative">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{t("landing.opt.card.label")}</span>
              </div>
              <div className="space-y-3">
                <SuggestionCard title={t("landing.opt.demo1.title")} amount={t("landing.opt.demo1.amount")} desc={t("landing.opt.demo1.desc")} />
                <SuggestionCard title={t("landing.opt.demo2.title")} amount={t("landing.opt.demo2.amount")} desc={t("landing.opt.demo2.desc")} />
                <SuggestionCard title={t("landing.opt.demo3.title")} amount={t("landing.opt.demo3.amount")} desc={t("landing.opt.demo3.desc")} />
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

function SuggestionCard({ title, amount, desc }: { title: string; amount: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="text-sm font-medium">{title}</div>
        <div className="max-w-full whitespace-normal break-words rounded-md bg-success/10 px-2 py-0.5 text-xs font-semibold leading-snug text-success sm:shrink-0 sm:text-right">
          {amount}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function CTASection() {
  const t = useT();
  return (
    <section className="border-t border-border/50 py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-primary p-12 text-center shadow-elegant">
          <div className="absolute inset-0 grid-bg opacity-20" aria-hidden />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
              {t("landing.cta.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/90">{t("landing.cta.desc")}</p>
            <Link to="/auth" search={{ mode: "signup" }} className="mt-8 inline-block">
              <Button size="lg" variant="secondary" className="h-12 px-8 text-foreground shadow-card">
                {t("landing.cta.button")}
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
  const t = useT();
  return (
    <footer className="border-t border-border/50 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          {t("landing.footer.brand")}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe2 className="h-3.5 w-3.5" />
          {t("landing.footer.scope")}
        </div>
      </div>
    </footer>
  );
}
