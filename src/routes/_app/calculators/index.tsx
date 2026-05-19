import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  Coins,
  HeartPulse,
  BarChart3,
  Briefcase,
  ArrowRight,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { CalcCard } from "@/components/calculators/CalcUI";
import { useT } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/_app/calculators/")({
  head: () => ({ meta: [{ title: "Calculateurs · SwissBroker Pro" }] }),
  component: CalculatorsIndex,
});

type SubLink = {
  to?: string;
  href?: string; // external
  labelKey: string;
};

type ModuleDef = {
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  soonKey?: string;
  links: SubLink[];
};

const MODULES: ModuleDef[] = [
  {
    icon: ShieldCheck,
    titleKey: "calc.module.prevoyance.title",
    descKey: "calc.module.prevoyance.desc",
    soonKey: "calc.module.prevoyance.soon",
    links: [
      { to: "/calculators/avs-ai", labelKey: "calc.avs_ai.title" },
      { to: "/calculators/lpp", labelKey: "calc.lpp.title" },
      { to: "/calculators/vested-benefits", labelKey: "calc.vested.title" },
      { to: "/calculators/pillar3a", labelKey: "calc.pillar3a.title" },
    ],
  },
  {
    icon: Coins,
    titleKey: "calc.module.fiscalite.title",
    descKey: "calc.module.fiscalite.desc",
    links: [
      { to: "/calculators/tax-global", labelKey: "calc.global.title" },
      { to: "/calculators/income-tax", labelKey: "calc.sublink.income_tax_resident" },
      { to: "/calculators/source-tax", labelKey: "calc.sublink.source_tax_ge" },
      { to: "/calculators/tou", labelKey: "calc.tou.title" },
      { to: "/calculators/cross-border", labelKey: "calc.sublink.cross_border_1983" },
      { to: "/calculators/overtime", labelKey: "calc.overtime.title" },
    ],
  },
  {
    icon: HeartPulse,
    titleKey: "calc.module.assurances.title",
    descKey: "calc.module.assurances.desc",
    links: [
      { to: "/calculators/health-insurance-france", labelKey: "calc.sublink.health_cmu_lamal" },
      { href: "https://primeinfos.ch", labelKey: "calc.sublink.health_lamal_residents" },
    ],
  },
  {
    icon: BarChart3,
    titleKey: "calc.module.comparateurs.title",
    descKey: "calc.module.comparateurs.desc",
    links: [
      { to: "/calculators/canton-compare", labelKey: "calc.canton_compare.title" },
      { to: "/calculators/retirement", labelKey: "calc.retirement.title" },
      { to: "/calculators/investment-compare", labelKey: "calc.invcompare.title" },
    ],
  },
  {
    icon: Briefcase,
    titleKey: "calc.module.dirigeants.title",
    descKey: "calc.module.dirigeants.desc",
    links: [
      { to: "/calculators/director-compensation", labelKey: "calc.sublink.director_salary_div" },
    ],
  },
];

function CalculatorsIndex() {
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
      {MODULES.map((mod) => (
        <ModuleCard key={mod.titleKey} mod={mod} t={t} />
      ))}
    </div>
  );
}

function ModuleCard({
  mod,
  t,
}: {
  mod: ModuleDef;
  t: (key: string) => string;
}) {
  const Icon = mod.icon;
  return (
    <div className="flex flex-col">
      <CalcCard className="flex h-full flex-col p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight">
              {t(mod.titleKey)}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t(mod.descKey)}
            </p>
          </div>
        </div>
        <ul className="mt-5 flex flex-col gap-1">
          {mod.links.map((link) => (
            <li key={link.labelKey}>
              {link.to ? (
                <Link
                  to={link.to}
                  className="group flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                >
                  <span>{t(link.labelKey)}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ) : (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t("calc.external.new_window")}
                  className="group flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                >
                  <span>{t(link.labelKey)}</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </li>
          ))}
        </ul>
      </CalcCard>
      {mod.soonKey && (
        <p className="mt-2 px-1 text-xs italic text-muted-foreground">
          {t(mod.soonKey)}
        </p>
      )}
    </div>
  );
}
