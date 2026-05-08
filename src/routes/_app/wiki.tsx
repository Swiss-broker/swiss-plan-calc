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
import { useT, useLanguage } from "@/contexts/LanguageContext";
import { getWikiArticles, getWikiCategories, type WikiArticle } from "@/lib/wiki/articles";

const searchSchema = z.object({
  article: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/_app/wiki")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Wiki & formation · SwissBroker Pro" }] }),
  component: WikiPage,
});

function WikiPage() {
  const t = useT();
  const { lang } = useLanguage();
  const ARTICLES = useMemo(() => getWikiArticles(lang), [lang]);
  const CATEGORIES = useMemo(() => getWikiCategories(lang), [lang]);

  const { article: targetArticle } = Route.useSearch();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [openItems, setOpenItems] = useState<string[]>([]);

  useEffect(() => {
    if (!targetArticle) return;
    const found = ARTICLES.find((a) => a.id === targetArticle);
    if (!found) return;
    setCat(null);
    setQ("");
    setOpenItems((prev) => (prev.includes(targetArticle) ? prev : [...prev, targetArticle]));
    const tm = setTimeout(() => {
      const el = document.getElementById(`wiki-${targetArticle}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary", "rounded-xl");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary", "rounded-xl"), 2200);
      }
    }, 120);
    return () => clearTimeout(tm);
  }, [targetArticle, ARTICLES]);

  const filtered = useMemo(() => {
    const tt = q.trim().toLowerCase();
    return ARTICLES.filter((a) => {
      if (cat && a.category !== cat) return false;
      if (!tt) return true;
      return (
        a.title.toLowerCase().includes(tt) ||
        a.tags.some((tag) => tag.toLowerCase().includes(tt)) ||
        a.category.toLowerCase().includes(tt)
      );
    });
  }, [q, cat, ARTICLES]);

  const grouped = useMemo(() => {
    const m = new Map<string, WikiArticle[]>();
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
            <h1 className="text-2xl font-bold tracking-tight">{t("wiki.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("wiki.subtitle")}</p>
          </div>
        </div>

        <div className="mt-5 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("wiki.search.placeholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 h-11 text-sm"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <CategoryChip active={cat === null} onClick={() => setCat(null)}>
            {t("wiki.all", { count: ARTICLES.length })}
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
          {t("wiki.empty")}
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                {category}
              </h2>
              <div className="rounded-2xl border border-border bg-card shadow-card">
                <Accordion
                  type="multiple"
                  className="w-full"
                  value={openItems}
                  onValueChange={setOpenItems}
                >
                  {items.map((a) => (
                    <AccordionItem
                      key={a.id}
                      value={a.id}
                      id={`wiki-${a.id}`}
                      className="border-b last:border-0 px-4 transition-shadow"
                    >
                      <AccordionTrigger className="text-sm font-medium hover:no-underline">
                        <div className="flex items-center gap-2 text-left">
                          <ChevronRight className="h-3.5 w-3.5 text-primary" />
                          {a.title}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed pl-6">
                        {a.body}
                        <div className="mt-3 flex flex-wrap gap-1">
                          {a.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px]">
                              {tag}
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
        <QuickCard to="/clients" icon={Users} title={t("wiki.quick.clients.title")} desc={t("wiki.quick.clients.desc")} />
        <QuickCard to="/calculators" icon={Calculator} title={t("wiki.quick.calculators.title")} desc={t("wiki.quick.calculators.desc")} />
        <QuickCard to="/companies" icon={Building2} title={t("wiki.quick.companies.title")} desc={t("wiki.quick.companies.desc")} />
      </div>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        <Sparkles className="inline h-3 w-3" /> {t("wiki.footer")}
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
