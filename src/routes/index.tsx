// src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, CheckCircle2, Building2, Globe2,
  Clock, Shield, Sparkles, TrendingUp, Calculator, Lock, ChevronDown,
} from "lucide-react";
import { useT } from "@/contexts/LanguageContext";
import { PublicLanguageSwitcher } from "@/components/common/PublicLanguageSwitcher";
import { t as tStatic } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";
import { LEGAL_PAGES } from "@/lib/legal/pages";
// Logo réel du cabinet, remplace l'icône "S" et le texte générés en CSS.
import logoIcon from "@/assets/logo-icon.png";
import logoFull from "@/assets/logo-full.png";

const CALCOM_URL = "https://cal.com/swissbroker/30min";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: tStatic("landing.head.title") },
      { name: "description", content: tStatic("landing.head.desc") },
    ],
  }),
  component: Landing,
});

function AnimCount({ value, inView }: { value: number; inView: boolean }) {
  const mv = useMotionValue(0);
  const sp = useSpring(mv, { duration: 1800, bounce: 0 });
  const [d, setD] = useState("0");
  useEffect(() => { if (inView) mv.set(value); }, [inView, value, mv]);
  useEffect(() => sp.on("change", (v) => setD(Math.round(v).toLocaleString("fr-CH"))), [sp]);
  return <>{d}</>;
}

// Formatage suisse (apostrophe) pour les nombres animés, cohérent avec les
// chiffres déjà écrits en dur dans les textes (ex. "40'000 à 50'000 CHF").
function formatApostrophe(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

function AnimNumberToken({ target, inView }: { target: number; inView: boolean }) {
  const mv = useMotionValue(0);
  const sp = useSpring(mv, { duration: 1800, bounce: 0 });
  const [d, setD] = useState("0");
  useEffect(() => { if (inView) mv.set(target); }, [inView, target, mv]);
  useEffect(() => sp.on("change", (v) => setD(formatApostrophe(v))), [sp]);
  return <>{d}</>;
}

// Anime chaque nombre trouvé dans un texte (ex. "40'000 à 50'000 CHF", "3%",
// "8 à 12") en le faisant monter depuis 0, en gardant le reste du texte
// (unités, séparateurs) statique.
function AnimRangeText({ text, inView }: { text: string; inView: boolean }) {
  const parts = text.split(/(\d[\d']*)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\d/.test(part)
          ? <AnimNumberToken key={i} target={parseInt(part.replace(/'/g, ""), 10)} inView={inView} />
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

const fadeUp = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } };

// Anime chaque élément selon SA PROPRE position à l'écran, pas celle d'une
// section parente : dans une section haute (Fonctionnalités, Modules), une
// carte loin en dessous du pli ne doit pas se déclencher en même temps que
// le haut de la section, sinon son animation est déjà terminée bien avant
// que l'utilisateur ne la fasse défiler jusqu'à l'écran.
function Reveal({
  children, delay = 0, y = 30, scale, className, whileHover,
}: {
  children: ReactNode | ((inView: boolean) => ReactNode);
  delay?: number; y?: number; scale?: number; className?: string;
  whileHover?: Record<string, number>;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const initial: Record<string, number> = { opacity: 0, y };
  const animate: Record<string, number> = { opacity: 1, y: 0 };
  if (scale !== undefined) { initial.scale = scale; animate.scale = 1; }
  return (
    <motion.div ref={ref} initial={initial} animate={inView ? animate : undefined}
      transition={{ type: "spring", stiffness: 140, damping: 16, delay }}
      whileHover={whileHover} className={className}>
      {typeof children === "function" ? children(inView) : children}
    </motion.div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />
      <Hero />
      <Features />
      <Modules />
      <Optimization />
      <Path />
      <CTASection />
      <FAQ />
      <Footer />
    </div>
  );
}

function Header() {
  const t = useT();
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}
      className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <img src={logoIcon} alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain shadow-elegant" />
          <img src={logoFull} alt="SwissBroker Pro" className="h-6 w-auto shrink-0 object-contain" />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.nav.features")}</a>
          <a href="#modules" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.nav.modules")}</a>
          <a href="#optimisation" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.nav.optimization")}</a>
          <a href={CALCOM_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors">Réserver une démo</a>
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <PublicLanguageSwitcher />
          <Link to="/auth"><Button variant="ghost" size="sm" className="px-2 sm:px-3">{t("landing.cta.signin")}</Button></Link>
        </div>
      </div>
    </motion.header>
  );
}

function Hero() {
  const t = useT();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const commissionItems = [
    { num: t("landing.commissions.item1.num"), label: t("landing.commissions.item1.label"), desc: t("landing.commissions.item1.desc") },
    { num: t("landing.commissions.item2.num"), label: t("landing.commissions.item2.label"), desc: t("landing.commissions.item2.desc") },
    { num: t("landing.commissions.item3.num"), label: t("landing.commissions.item3.label"), desc: t("landing.commissions.item3.desc") },
    { num: t("landing.commissions.item4.num"), label: t("landing.commissions.item4.label"), desc: t("landing.commissions.item4.desc") },
  ];
  return (
    <section ref={ref} className="relative overflow-hidden">
      {/* Fond dégradé riche */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a2e2b] via-[#0f4c47] to-[#1a6b64]" />
      <div className="absolute inset-0 grid-bg opacity-10" aria-hidden />
      <motion.div className="absolute top-10 right-20 w-80 h-80 rounded-full bg-primary/20 blur-[100px]"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 8, repeat: Infinity }} />
      <motion.div className="absolute bottom-10 left-20 w-96 h-96 rounded-full bg-emerald-400/10 blur-[120px]"
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.2, 0.4, 0.2] }} transition={{ duration: 10, repeat: Infinity }} />

      <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-emerald-300" />{t("landing.hero.badge")}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 50, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.2 }}
            className="text-balance text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
            {t("landing.hero.title.prefix")}{" "}<span className="text-emerald-300">{t("landing.hero.title.highlight")}</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35 }}
            className="mx-auto mt-6 max-w-2xl text-balance text-lg text-white/70">
            <strong className="font-semibold text-white/90">{t("landing.hero.subtitle.lead")}</strong>{" "}{t("landing.hero.subtitle.rest")}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a href={CALCOM_URL} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="h-12 px-8 bg-emerald-400 text-emerald-950 hover:bg-emerald-300 shadow-lg shadow-emerald-400/25 group">
                Réserver une démo<ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </a>
            <a href="#modules"><Button size="lg" variant="outline" className="h-12 px-8 border-white/30 text-white hover:bg-white/10">Découvrir les modules</Button></a>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/60">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />Barèmes officiels AFC 2026</span>
          </motion.div>
        </div>

        {/* Potentiel de revenu intégré dans le hero */}
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.8 }}
          className="mx-auto mt-16 max-w-6xl">
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {commissionItems.map((it, i) => (
              <motion.div key={it.label} initial={{ opacity: 0, y: 10 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.9 + i * 0.1 }}
                className="hero-stat-card rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 text-left"
                style={{ animationDelay: `${i * 0.4}s` }}>
                <div className="relative z-[1] whitespace-nowrap text-lg font-extrabold tracking-tight text-emerald-300 tabular-nums sm:text-xl">
                  <AnimRangeText text={it.num} inView={inView} />
                </div>
                <p className="relative z-[1] mt-2 text-sm font-bold text-white">{it.label}</p>
                <p className="relative z-[1] mt-1 text-sm text-white/60 leading-relaxed">{it.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Features() {
  const t = useT();
  const stats = [
    { value: 12, label: "Modules de calcul" },
    { value: 9, label: "Cantons couverts" },
    { value: 2026, label: "Barèmes officiels" },
    { value: 20, label: "Minutes par RDV" },
  ];
  const items = [
    { icon: Clock, title: t("landing.feature.exact.title"), desc: t("landing.feature.exact.desc"), gradient: "from-emerald-500/20 to-teal-500/20", accent: "#059669" },
    { icon: Calculator, title: t("landing.feature.proj.title"), desc: t("landing.feature.proj.desc"), gradient: "from-blue-500/20 to-cyan-500/20", accent: "#2563eb" },
    { icon: Sparkles, title: t("landing.feature.opt.title"), desc: t("landing.feature.opt.desc"), gradient: "from-violet-500/20 to-purple-500/20", accent: "#7c3aed" },
    { icon: Shield, title: t("landing.feature.priv.title"), desc: t("landing.feature.priv.desc"), gradient: "from-amber-500/20 to-orange-500/20", accent: "#d97706" },
  ];
  return (
    <section id="features" className="py-20 bg-gradient-to-b from-muted/50 to-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal y={45} scale={0.96} className="mx-auto max-w-5xl text-center mb-10">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-emerald-800 sm:text-4xl">{t("landing.features.title")}</h2>
          <p className="mt-3 text-muted-foreground">{t("landing.features.subtitle")}</p>
        </Reveal>
        <div className="mx-auto mb-14 grid max-w-5xl gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08} y={20}
              className="rounded-2xl border border-border bg-muted p-6 text-center">
              {(inView) => (
                <>
                  <div className="text-3xl font-extrabold tracking-tight text-emerald-600 tabular-nums">
                    <AnimCount value={s.value} inView={inView} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
                </>
              )}
            </Reveal>
          ))}
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => (
            <Reveal key={it.title} delay={i * 0.08} y={50} whileHover={{ y: -8, scale: 1.02 }}
              className={`group rounded-2xl border border-border bg-gradient-to-br ${it.gradient} p-6 shadow-card cursor-default backdrop-blur-sm`}>
              <div className="feature-icon-badge mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-background/80 shadow-sm transition-all group-hover:shadow-md group-hover:scale-110"
                style={{ color: it.accent, ["--accent" as string]: it.accent, animationDelay: `${i * 0.25}s` }}>
                <it.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold mb-2">{it.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{it.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Modules() {
  const t = useT();
  const modules = [
    { tag: t("landing.module.tax.tag"), title: t("landing.module.tax.title"), desc: t("landing.module.tax.desc"), color: "bg-blue-500" },
    { tag: t("landing.module.source.tag"), title: t("landing.module.source.title"), desc: t("landing.module.source.desc"), color: "bg-emerald-500" },
    { tag: t("landing.module.lpp.tag"), title: t("landing.module.lpp.title"), desc: t("landing.module.lpp.desc"), color: "bg-violet-500" },
    { tag: t("landing.module.p3.tag"), title: t("landing.module.p3.title"), desc: t("landing.module.p3.desc"), color: "bg-amber-500" },
    { tag: t("landing.module.scen.tag"), title: t("landing.module.scen.title"), desc: t("landing.module.scen.desc"), color: "bg-rose-500" },
    { tag: t("landing.module.cmp.tag"), title: t("landing.module.cmp.title"), desc: t("landing.module.cmp.desc"), color: "bg-cyan-500" },
  ];
  return (
    <section id="modules" className="py-20 bg-gradient-to-b from-background via-primary/5 to-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal y={45} scale={0.96} className="mx-auto max-w-3xl text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight text-emerald-800 sm:text-4xl">
            {/* Deux phrases courtes : chacune sa propre ligne, jamais coupée
                au milieu par le retour à la ligne naturel du navigateur. */}
            {t("landing.modules.title").split(/(?<=\.)\s+/).map((sentence, i) => (
              <span key={i} className="block">{sentence}</span>
            ))}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("landing.modules.subtitle")}</p>
        </Reveal>
        <Reveal y={40} scale={0.97} whileHover={{ scale: 1.015, y: -4 }}
          className="mx-auto mb-14 max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-card hover:shadow-elegant transition-shadow">
          <video
            className="aspect-video w-full bg-black"
            src="/guided-tour.mp4"
            poster="/guided-tour-poster.jpg"
            controls
            preload="metadata"
            playsInline
          />
        </Reveal>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((m, i) => (
            <Reveal key={m.title} delay={i * 0.08} y={40} scale={0.95} whileHover={{ scale: 1.03, y: -4 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-card hover:shadow-elegant transition-shadow cursor-default">
              <div className="mb-3 flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${m.color}`} />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">{m.tag}</span>
              </div>
              <h3 className="text-base font-semibold mb-2">{m.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Optimization() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const t = useT();
  const bullets = [t("landing.opt.b1"), t("landing.opt.b2"), t("landing.opt.b3"), t("landing.opt.b4"), t("landing.opt.b5")];
  const demos = [
    { title: t("landing.opt.demo1.title"), amount: t("landing.opt.demo1.amount"), desc: t("landing.opt.demo1.desc") },
    { title: t("landing.opt.demo2.title"), amount: t("landing.opt.demo2.amount"), desc: t("landing.opt.demo2.desc") },
    { title: t("landing.opt.demo3.title"), amount: t("landing.opt.demo3.amount"), desc: t("landing.opt.demo3.desc") },
  ];
  return (
    <section id="optimisation" ref={ref} className="py-20 bg-gradient-to-br from-[#0a2e2b] via-[#0f4c47] to-[#1a6b64] text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, x: -40 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.7 }}>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
              <Sparkles className="h-3 w-3 text-emerald-300" /> {t("landing.opt.badge")}
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.opt.title")}</h2>
            <p className="mt-4 text-white/70">{t("landing.opt.desc")}</p>
            <ul className="mt-6 space-y-3 text-sm">
              {bullets.map((b, i) => (
                <motion.li key={i} initial={{ opacity: 0, x: -20 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span className="text-white/80">{b}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 40 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.7, delay: 0.2 }}>
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-300" />
                <span className="text-sm font-medium text-white/90">{t("landing.opt.card.label")}</span>
              </div>
              <div className="space-y-3">
                {demos.map((d, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.4, delay: 0.5 + i * 0.15 }}
                    className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="text-sm font-medium text-white/90">{d.title}</div>
                      <div className="whitespace-nowrap rounded-md bg-emerald-400/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">{d.amount}</div>
                    </div>
                    <p className="mt-1 text-xs text-white/50">{d.desc}</p>
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

function Path() {
  const t = useT();
  const steps = [
    { title: t("landing.path.step1.title"), desc: t("landing.path.step1.desc") },
    { title: t("landing.path.step2.title"), desc: t("landing.path.step2.desc") },
    { title: t("landing.path.step3.title"), desc: t("landing.path.step3.desc") },
    { title: t("landing.path.step4.title"), desc: t("landing.path.step4.desc") },
  ];
  const trust = [
    { icon: Lock, title: t("landing.trust.isolation.title"), desc: t("landing.trust.isolation.desc") },
    { icon: Shield, title: t("landing.trust.encryption.title"), desc: t("landing.trust.encryption.desc") },
    { icon: CheckCircle2, title: t("landing.trust.noCommitment.title"), desc: t("landing.trust.noCommitment.desc") },
  ];
  return (
    <section className="py-20 bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal y={45} scale={0.96} className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-emerald-800 sm:text-4xl">{t("landing.path.title")}</h2>
          <p className="mt-3 text-muted-foreground">{t("landing.path.subtitle")}</p>
        </Reveal>

        <div className="relative">
          {/* Ligne pointillée continue derrière les 4 puces numérotées : chaque
              puce a un fond opaque qui la recouvre à son emplacement, ce qui
              donne visuellement des segments entre les puces sans calcul de
              position par élément. */}
          <div className="pointer-events-none absolute left-0 right-0 top-6 hidden border-t-2 border-dashed border-border lg:block" />
          <div className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.1} y={30} className="text-center">
                <div className="relative z-10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-base font-extrabold text-white shadow-lg shadow-emerald-600/30">
                  {i + 1}
                </div>
                <h3 className="text-sm font-semibold mb-1.5">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {trust.map((tr, i) => (
            <Reveal key={tr.title} delay={i * 0.08} y={30}
              className="flex items-start gap-3 rounded-2xl border border-border bg-muted p-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <tr.icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-1">{tr.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{tr.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="text-sm font-semibold">{q}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-primary transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{a}</p>
        </div>
      </div>
    </div>
  );
}

function FAQ() {
  const t = useT();
  const items = [
    { q: t("landing.faq.q1.title"), a: t("landing.faq.q1.answer") },
    { q: t("landing.faq.q2.title"), a: t("landing.faq.q2.answer") },
    { q: t("landing.faq.q3.title"), a: t("landing.faq.q3.answer") },
    { q: t("landing.faq.q4.title"), a: t("landing.faq.q4.answer") },
    { q: t("landing.faq.q5.title"), a: t("landing.faq.q5.answer") },
    { q: t("landing.faq.q6.title"), a: t("landing.faq.q6.answer") },
    { q: t("landing.faq.q7.title"), a: t("landing.faq.q7.answer") },
    { q: t("landing.faq.q8.title"), a: t("landing.faq.q8.answer") },
    { q: t("landing.faq.q9.title"), a: t("landing.faq.q9.answer") },
  ];
  return (
    <section className="py-20 bg-muted/40">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal y={45} scale={0.96} className="mx-auto max-w-2xl text-center mb-14">
          <h2 className="text-3xl font-bold tracking-tight text-emerald-800 sm:text-4xl">{t("landing.faq.title")}</h2>
          <p className="mt-3 text-muted-foreground">{t("landing.faq.subtitle")}</p>
        </Reveal>
        <div className="space-y-3">
          {items.map((it, i) => (
            <Reveal key={it.q} delay={i * 0.05} y={20}>
              <FAQItem q={it.q} a={it.a} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const t = useT();
  return (
    <section ref={ref} className="py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={inView ? { opacity: 1, scale: 1 } : {}} transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-emerald-600 to-teal-600 p-12 text-center shadow-2xl shadow-primary/20">
          <motion.div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{t("landing.cta.title")}</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/80">{t("landing.cta.desc")}</p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} className="mt-8 inline-block">
              <a href={CALCOM_URL} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="h-12 px-8 bg-white text-emerald-900 hover:bg-white/90 shadow-lg">
                  Réserver une démo<ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </a>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  const t = useT();
  return (
    <footer className="border-t border-border/50 py-14">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:grid-cols-[2fr_1fr] sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <img src={logoIcon} alt="" className="h-7 w-7 shrink-0 rounded-lg object-contain" />
            <img src={logoFull} alt="SwissBroker Pro" className="h-5 w-auto shrink-0 object-contain" />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="h-4 w-4" />{t("landing.footer.brand")}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Globe2 className="h-3.5 w-3.5" />{t("landing.footer.scope")}</div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Légal</p>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
            {[LEGAL_PAGES.slice(0, 4), LEGAL_PAGES.slice(4)].map((column, i) => (
              <ul key={i} className="space-y-2">
                {column.map((p) => (
                  <li key={p.path}>
                    <Link to={p.path} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}