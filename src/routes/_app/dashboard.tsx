import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  Calculator,
  TrendingUp,
  Sparkles,
  ArrowRight,
  PlusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord · SwissBroker Pro" }] }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bienvenue sur votre espace courtier. Démarrez par créer un dossier client ou
            utilisez un calculateur rapide.
          </p>
        </div>
        <Link to="/clients">
          <Button className="shadow-elegant">
            <PlusCircle className="h-4 w-4" />
            Nouveau client
          </Button>
        </Link>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Clients actifs" value="0" icon={Users} />
        <KpiCard label="Simulations ce mois" value="0" icon={TrendingUp} />
        <KpiCard label="Calculateurs rapides" value="8" icon={Calculator} />
        <KpiCard label="Optimisations détectées" value="—" icon={Sparkles} />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <ActionCard
          to="/clients"
          title="Gérer mes clients"
          desc="Créez un dossier complet : identité, situation fiscale, prévoyance, patrimoine. Lancez ensuite des simulations chiffrées."
          cta="Voir mes clients"
        />
        <ActionCard
          to="/calculators"
          title="Calculateurs rapides"
          desc="Impôts, rachat LPP, économie 3a, comparateur cantonal · sans créer de dossier client."
          cta="Ouvrir les calculateurs"
        />
      </div>

      <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-primary" />
        <h3 className="mt-3 text-lg font-semibold">Le moteur de calcul fiscal arrive</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          La fondation est en place : authentification, design system, base de données
          sécurisée pour la Suisse romande. Les modules de calcul (IFD, ICC, LPP, 3a,
          frontaliers) et le moteur d'optimisation arrivent dans les prochaines itérations.
        </p>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function ActionCard({
  to,
  title,
  desc,
  cta,
}: {
  to: "/clients" | "/calculators";
  title: string;
  desc: string;
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      <Link to={to} className="mt-4 inline-block">
        <Button variant="outline" size="sm">
          {cta}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
