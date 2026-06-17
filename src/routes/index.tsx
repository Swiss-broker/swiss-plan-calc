import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, CheckCircle2, Building2, Globe2, X, Check, Zap,
  Clock, Shield, Sparkles, TrendingUp, Calculator,
} from "lucide-react";
import { useT } from "@/contexts/LanguageContext";
import { PublicLanguageSwitcher } from "@/components/common/PublicLanguageSwitcher";
import { t as tStatic } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";

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
  const [pricingOpen, setPricingOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header onPricingOpen={() => setPricingOpen(true)} />
      {pricingOpen && <PricingModal onClose={() => setPricingOpen(false)} />}
      <Hero onPricingOpen={() => setPricingOpen(true)} />
      <StatsBar />
      <Features />
      <Modules />
      <Optimization />
      <CTASection onPricingOpen={() => setPricingOpen(true)} />
      <Footer />
    </div>
  );
}

function Header({ onPricingOpen }: { onPricingOpen: () => void }) {
  const t = useT();
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl"
    >
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
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.nav.features")}</a>
          <a href="#modules" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.nav.modules")}</a>
          <a href="#optimisation" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.nav.optimization")}</a>
          <button onClick={onPricingOpen} className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors">Tarifs</button>
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <PublicLanguageSwitcher />
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="px-2 sm:px-3">{t("landing.cta.signin")}</Button>
          </Link>
          <Button size="sm" className="shadow-elegant" onClick={onPricingOpen}>
            <span className="hidden sm:inline">{t("landing.cta.try")}</span>
            <span className="sm:hidden">Essayer</span>
          </Button>
        </div>
      </div>
    </motion.header>
  );
}

function Hero({ onPricingOpen }: { onPricingOpen: () => void }) {
  const t = useT();
  return (
    <section className="relative overflow-hidden bg-hero min-h-[90vh] flex items-center">
      <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
      <motion.div
        className="absolute top-20 right-10 w-72 h-72 rounded-full bg-primary/5 blur-3xl"
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-20 left-10 w-96 h-96 rounded-full bg-primary/5 blur-3xl"
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8 w-full">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t("landing.hero.badge")}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl"
          >
            {t("landing.hero.title.prefix")}{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              {t("landing.hero.title.highlight")}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground"
          >
            {t("landing.hero.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Button size="lg" className="h-12 px-8 shadow-elegant group" onClick={onPricingOpen}>
              Créer mon compte
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <a href="#modules">
              <Button size="lg" variant="outline" className="h-12 px-8">
                Découvrir les modules
              </Button>
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.7 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground"
          >
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              3 jours d'essai gratuits
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              Barèmes officiels AFC 2026
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              <button onClick={onPricingOpen} className="font-semibold text-primary underline-offset-2 hover:underline">
                Voir les tarifs →
              </button>
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function StatsBar() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const stats = [
    { value: 12, label: "Modules de calcul" },
    { value: 9, label: "Cantons couverts" },
    { value: 2026, label: "Barèmes officiels" },
    { value: 20, label: "Minutes par RDV" },
  ];
  return (
    <section ref={ref} className="border-t border-border/50 bg-gradient-to-b from-primary/5 to-transparent">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl font-extrabold text-primary tabular-nums">
                <AnimatedCounter value={s.value} inView={inView} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AnimatedCounter({ value, inView }: { value: number; inView: boolean }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { duration: 1800, bounce: 0 });
  const [display, setDisplay] = useState("0");
  useEffect(() => {
    if (inView) motionVal.set(value);
  }, [inView, value, motionVal]);
  useEffect(() => {
    return spring.on("change", (v) => setDisplay(Math.round(v).toLocaleString("fr-CH")));
  }, [spring]);
  return <>{display}</>;
}

function Features() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const t = useT();
  const items = [
    { icon: Clock, title: t("landing.feature.exact.title"), desc: t("landing.feature.exact.desc") },
    { icon: Calculator, title: t("landing.feature.proj.title"), desc: t("landing.feature.proj.desc") },
    { icon: Sparkles, title: t("landing.feature.opt.title"), desc: t("landing.feature.opt.desc") },
    { icon: Shield, title: t("landing.feature.priv.title"), desc: t("landing.feature.priv.desc") },
  ];
  return (
    <section id="features" ref={ref} className="border-t border-border/50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.features.title")}</h2>
          <p className="mt-4 text-muted-foreground">{t("landing.features.subtitle")}</p>
        </motion.div>
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => (
            <FeatureCard key={it.title} item={it} index={i} inView={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ item, index, inView }: { item: { icon: React.ElementType; title: string; desc: string }; index: number; inView: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.12 }}
      whileHover={{ y: -6, rotateX: 2, rotateY: 2 }}
      style={{ transformStyle: "preserve-3d", perspective: 1000 }}
      className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-elegant cursor-default"
    >
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <item.icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold">{item.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
    </motion.div>
  );
}

function Modules() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const t = useT();
  const modules = [
    { tag: t("landing.module.tax.tag"), title: t("landing.module.tax.title"), desc: t("landing.module.tax.desc"), emoji: "🏛" },
    { tag: t("landing.module.source.tag"), title: t("landing.module.source.title"), desc: t("landing.module.source.desc"), emoji: "🌍" },
    { tag: t("landing.module.lpp.tag"), title: t("landing.module.lpp.title"), desc: t("landing.module.lpp.desc"), emoji: "🏦" },
    { tag: t("landing.module.p3.tag"), title: t("landing.module.p3.title"), desc: t("landing.module.p3.desc"), emoji: "💰" },
    { tag: t("landing.module.scen.tag"), title: t("landing.module.scen.title"), desc: t("landing.module.scen.desc"), emoji: "🔄" },
    { tag: t("landing.module.cmp.tag"), title: t("landing.module.cmp.title"), desc: t("landing.module.cmp.desc"), emoji: "📊" },
  ];
  return (
    <section id="modules" ref={ref} className="border-t border-border/50 bg-muted/30 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.modules.title")}</h2>
          <p className="mt-4 text-muted-foreground">{t("landing.modules.subtitle")}</p>
        </motion.div>
        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((m, i) => (
            <motion.div
              key={m.title}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ scale: 1.02 }}
              className="rounded-2xl border border-border bg-card p-6 shadow-card"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="text-2xl">{m.emoji}</span>
                <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {m.tag}
                </span>
              </div>
              <h3 className="text-lg font-semibold">{m.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Optimization() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const t = useT();
  const bullets = [
    t("landing.opt.b1"),
    t("landing.opt.b2"),
    t("landing.opt.b3"),
    t("landing.opt.b4"),
    t("landing.opt.b5"),
  ];
  const demos = [
    { title: t("landing.opt.demo1.title"), amount: t("landing.opt.demo1.amount"), desc: t("landing.opt.demo1.desc") },
    { title: t("landing.opt.demo2.title"), amount: t("landing.opt.demo2.amount"), desc: t("landing.opt.demo2.desc") },
    { title: t("landing.opt.demo3.title"), amount: t("landing.opt.demo3.amount"), desc: t("landing.opt.demo3.desc") },
  ];
  return (
    <section id="optimisation" ref={ref} className="border-t border-border/50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
              <Sparkles className="h-3 w-3 text-primary" /> {t("landing.opt.badge")}
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.opt.title")}</h2>
            <p className="mt-4 text-muted-foreground">{t("landing.opt.desc")}</p>
            <ul className="mt-6 space-y-3 text-sm">
              {bullets.map((b, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                  className="flex gap-3"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{b}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{t("landing.opt.card.label")}</span>
              </div>
              <div className="space-y-3">
                {demos.map((d, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.4, delay: 0.5 + i * 0.15 }}
                    className="rounded-xl border border-border bg-background p-4"
                  >
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="text-sm font-medium">{d.title}</div>
                      <div className="max-w-full whitespace-normal break-words rounded-md bg-success/10 px-2 py-0.5 text-xs font-semibold leading-snug text-success sm:shrink-0 sm:text-right">
                        {d.amount}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{d.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function CTASection({ onPricingOpen }: { onPricingOpen: () => void }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const t = useT();
  return (
    <section ref={ref} className="border-t border-border/50 py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-3xl border border-border bg-gradient-primary p-12 text-center shadow-elegant"
        >
          <div className="absolute inset-0 grid-bg opacity-20" aria-hidden />
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-primary/20"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
              {t("landing.cta.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/90">{t("landing.cta.desc")}</p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} className="mt-8 inline-block">
              <Button size="lg" variant="secondary" className="h-12 px-8 text-foreground shadow-card" onClick={onPricingOpen}>
                {t("landing.cta.button")}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function useNavigate() {
  const { useNavigate: useNav } = require("@tanstack/react-router");
  return useNav();
}

function PlanButton({ plan, highlight }: { plan: string; highlight: boolean }) {
  const navigate = useNavigate();
  const handleClick = () => {
    navigate({ to: "/auth", search: { mode: "signup", plan: plan as "starter" | "pro" | "cabinet" } });
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
        highlight
          ? "bg-primary text-primary-foreground shadow-elegant hover:bg-primary/90"
          : "border border-border bg-background hover:bg-muted"
      }`}
    >
      {plan === "pro" ? "Démarrer mon essai gratuit" : `Commencer avec ${plan.charAt(0).toUpperCase() + plan.slice(1)}`}
    </button>
  );
}

function PricingModal({ onClose }: { onClose: () => void }) {
  const plans = [
    {
      name: "Starter", price: "490", priceMonthEquiv: "441", priceYear: "5'292",
      desc: "Idéal pour le courtier indépendant", highlight: false,
      features: ["10 dossiers clients", "2 sociétés", "Tous les calculateurs", "10 exports PDF par mois", "Assistant IA 10 conversations par jour"],
    },
    {
      name: "Pro", price: "790", priceMonthEquiv: "711", priceYear: "8'532",
      desc: "Pour le courtier actif en croissance", highlight: true,
      features: ["20 dossiers clients", "4 sociétés", "Tous les calculateurs", "Export PDF illimité", "Assistant IA illimité", "Support prioritaire"],
    },
    {
      name: "Cabinet", price: "1'290", priceMonthEquiv: "1'161", priceYear: "13'932",
      desc: "Pour les cabinets multi-collaborateurs", highlight: false,
      features: ["Clients illimités", "Sociétés illimitées", "Tous les calculateurs", "Export PDF illimité", "Assistant IA illimité", "+290 CHF par utilisateur supplémentaire", "Support dédié"],
    },
  ];
  const [yearly, setYearly] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3 }}
        className="relative w-full max-w-5xl rounded-3xl border border-border bg-background shadow-2xl overflow-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Choisissez votre plan</h2>
            <p className="mt-1 text-sm text-muted-foreground">3 jours d'essai gratuits sur tous les plans. Annulez à tout moment.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex justify-center pt-6">
          <div className="inline-flex items-center gap-3 rounded-full border border-border bg-muted/50 p-1">
            <button onClick={() => setYearly(false)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${!yearly ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>Mensuel</button>
            <button onClick={() => setYearly(true)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${yearly ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>
              Annuel <span className="ml-1 rounded-full bg-success/20 px-1.5 py-0.5 text-[10px] font-semibold text-success">−10%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl border-2 bg-card p-6 transition-all ${plan.highlight ? "border-primary shadow-[0_8px_30px_rgb(0,0,0,0.12)] scale-[1.02]" : "border-border hover:border-primary/40 hover:shadow-lg"}`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow-elegant">
                    <Zap className="h-3 w-3" /> Recommandé
                  </span>
                </div>
              )}
              <div className="mb-4">
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{plan.desc}</p>
              </div>
              <div className="mb-2">
                {yearly ? (
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold tabular-nums">{plan.priceYear}</span>
                      <span className="text-sm text-muted-foreground">CHF/an</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-success">soit {plan.priceMonthEquiv} CHF/mois · économie de 10%</p>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tabular-nums">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">CHF/mois</span>
                  </div>
                )}
              </div>
              <p className="mb-4 text-[11px] font-medium text-primary">✓ 3 jours d'essai gratuits inclus</p>
              <ul className="mb-6 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <PlanButton plan={plan.name.toLowerCase()} highlight={plan.highlight} />
              <p className="mt-2 text-center text-[10px] text-muted-foreground">Aucun débit avant J+3</p>
            </motion.div>
          ))}
        </div>

        <div className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Les 10 premiers abonnés bénéficient de −20% la première année (offre mensuelle) · Code : <span className="font-mono font-semibold text-primary">SWISSBROKER20</span></p>
          <p className="mt-1">Facturation en CHF · Piliarys · Annulation à tout moment · Support inclus</p>
        </div>
      </motion.div>
    </motion.div>
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
