// Cartes synthétiques rendues dans les onglets de la fiche client.
// Reçoivent le résultat du `useClientDashboard` et affichent les KPIs
// avec un lien "Voir détail" vers le calculateur correspondant pré-rempli.

import {
  Calculator,
  Landmark,
  PiggyBank,
  Map,
  Scale,
  Sparkles,
  HeartHandshake,
} from "lucide-react";
import {
  DashboardCard,
  DashboardEmpty,
  DashboardMetric,
} from "./DashboardCard";
import { OptimizationsPanel } from "@/components/optimizer/OptimizationsPanel";
import { formatCHF, formatPct } from "@/lib/format";
import { CANTON_BY_CODE } from "@/lib/swiss/cantons";
import type { ClientDashboard } from "@/lib/client-dashboard";

interface Props {
  dashboard: ClientDashboard;
  clientId: string;
}

const linkSearch = (clientId: string) => ({ clientId });

// ─── SYNTHÈSE ────────────────────────────────────────────────────────────

export function DashboardOverview({ dashboard, clientId }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      <DashboardCard
        title="Charge fiscale annuelle"
        icon={Calculator}
        detailLink={{ to: "/calculators/income-tax", search: linkSearch(clientId) }}
      >
        {dashboard.tax ? (
          <>
            <DashboardMetric
              label="Impôts totaux / an"
              value={formatCHF(dashboard.tax.annualBurden)}
              emphasis
            />
            <DashboardMetric
              label="Taux effectif"
              value={`${dashboard.tax.effectiveRate.toFixed(1)} %`}
            />
            <DashboardMetric
              label="Taux marginal"
              value={`${dashboard.tax.marginalRate.toFixed(1)} %`}
            />
            {dashboard.tax.monthlySourceTax !== null && (
              <DashboardMetric
                label="Impôt à la source / mois"
                value={formatCHF(dashboard.tax.monthlySourceTax)}
              />
            )}
          </>
        ) : (
          <DashboardEmpty>
            Renseignez canton, statut civil et salaire pour calculer la charge fiscale.
          </DashboardEmpty>
        )}
      </DashboardCard>

      <DashboardCard
        title="Capital LPP projeté"
        icon={Landmark}
        detailLink={{ to: "/calculators/lpp", search: linkSearch(clientId) }}
      >
        {dashboard.lpp ? (
          <>
            <DashboardMetric
              label="Capital projeté à 65 ans"
              value={formatCHF(dashboard.lpp.projectedCapitalAt65)}
              emphasis
            />
            <DashboardMetric
              label="Avoir actuel"
              value={formatCHF(dashboard.lpp.currentCapital)}
            />
            <DashboardMetric
              label="Rente mensuelle estimée"
              value={formatCHF(dashboard.lpp.monthlyPension)}
            />
            {dashboard.lpp.buybackCapacity > 0 && (
              <DashboardMetric
                label="Capacité de rachat"
                value={formatCHF(dashboard.lpp.buybackCapacity)}
              />
            )}
          </>
        ) : (
          <DashboardEmpty>Aucune donnée LPP renseignée.</DashboardEmpty>
        )}
      </DashboardCard>

      <DashboardCard
        title="Pilier 3a"
        icon={PiggyBank}
        detailLink={{ to: "/calculators/pillar3a", search: linkSearch(clientId) }}
      >
        {dashboard.pillar3a ? (
          <>
            <DashboardMetric
              label="Plafond 3a effectif"
              value={formatCHF(dashboard.pillar3a.effectiveCap)}
              emphasis
            />
            <DashboardMetric
              label="Versement actuel"
              value={formatCHF(dashboard.pillar3a.currentContribution)}
            />
            <DashboardMetric
              label="Marge non utilisée"
              value={formatCHF(dashboard.pillar3a.unusedRoom)}
            />
            <DashboardMetric
              label="Économie d'impôt actuelle"
              value={formatCHF(dashboard.pillar3a.taxSavings)}
            />
          </>
        ) : (
          <DashboardEmpty>3a non applicable pour ce statut.</DashboardEmpty>
        )}
      </DashboardCard>

      <DashboardCard
        title="Rente AVS/AI"
        icon={HeartHandshake}
        detailLink={{ to: "/calculators/avs-ai", search: linkSearch(clientId) }}
      >
        {dashboard.avs ? (
          <>
            <DashboardMetric
              label="Rente mensuelle estimée"
              value={formatCHF(dashboard.avs.monthlyPension)}
              emphasis
            />
            <DashboardMetric
              label="Rente annuelle"
              value={formatCHF(dashboard.avs.annualPension)}
            />
            <DashboardMetric
              label="Années cotisées"
              value={`${dashboard.avs.effectiveYears} / 44`}
              sub={
                dashboard.avs.missingYears > 0
                  ? `${dashboard.avs.missingYears} manquantes`
                  : undefined
              }
            />
            {dashboard.avs.combinedMonthlyPension !== undefined && (
              <DashboardMetric
                label="Rente couple / mois"
                value={formatCHF(dashboard.avs.combinedMonthlyPension)}
                sub={dashboard.avs.cappedCouple ? "plafonnée" : undefined}
              />
            )}
          </>
        ) : (
          <DashboardEmpty>
            Renseignez date de naissance et salaire pour estimer la rente AVS.
          </DashboardEmpty>
        )}
      </DashboardCard>
    </div>
  );
}

// ─── FISCALITÉ ───────────────────────────────────────────────────────────

export function DashboardFiscal({ dashboard, clientId }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DashboardCard
        title="Charge fiscale détaillée"
        icon={Calculator}
        detailLink={{ to: "/calculators/income-tax", search: linkSearch(clientId) }}
      >
        {dashboard.tax ? (
          <>
            <DashboardMetric
              label="Revenu brut"
              value={formatCHF(dashboard.tax.grossIncome)}
            />
            <DashboardMetric
              label="Impôts totaux"
              value={formatCHF(dashboard.tax.annualBurden)}
              emphasis
            />
            <DashboardMetric
              label="Taux effectif"
              value={formatPct(dashboard.tax.effectiveRate, 2)}
            />
            <DashboardMetric
              label="Taux marginal"
              value={formatPct(dashboard.tax.marginalRate, 2)}
            />
            {dashboard.tax.monthlySourceTax !== null && (
              <DashboardMetric
                label="IS mensuel"
                value={formatCHF(dashboard.tax.monthlySourceTax)}
              />
            )}
          </>
        ) : (
          <DashboardEmpty>Données insuffisantes.</DashboardEmpty>
        )}
      </DashboardCard>

      <DashboardCard
        title="Comparatif cantonal"
        icon={Map}
        detailLink={{
          to: "/calculators/canton-compare",
          search: linkSearch(clientId),
        }}
      >
        {dashboard.cantonCompare ? (
          <>
            <DashboardMetric
              label={`Canton actuel · ${dashboard.cantonCompare.current.code}`}
              value={formatCHF(dashboard.cantonCompare.current.total)}
            />
            <div className="mt-1 space-y-1 border-t border-border/60 pt-2">
              {dashboard.cantonCompare.best3.map((row) => (
                <DashboardMetric
                  key={row.code}
                  label={`${row.code} · ${CANTON_BY_CODE[row.code]?.name ?? row.name}`}
                  value={formatCHF(row.total)}
                  sub={
                    row.delta < 0 ? `−${formatCHF(Math.abs(row.delta))}` : undefined
                  }
                />
              ))}
            </div>
            {dashboard.cantonCompare.maxSavings > 0 && (
              <p className="mt-2 text-xs text-success">
                Économie max : {formatCHF(dashboard.cantonCompare.maxSavings)} / an
              </p>
            )}
          </>
        ) : (
          <DashboardEmpty>Canton non renseigné.</DashboardEmpty>
        )}
      </DashboardCard>
    </div>
  );
}

// ─── PRÉVOYANCE ──────────────────────────────────────────────────────────

export function DashboardPension({ dashboard, clientId }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DashboardCard
        title="Projection LPP"
        icon={Landmark}
        detailLink={{ to: "/calculators/lpp", search: linkSearch(clientId) }}
      >
        {dashboard.lpp ? (
          <>
            <DashboardMetric
              label="Capital à 65 ans"
              value={formatCHF(dashboard.lpp.projectedCapitalAt65)}
              emphasis
            />
            <DashboardMetric
              label="Rente annuelle"
              value={formatCHF(dashboard.lpp.annualPension)}
            />
            <DashboardMetric
              label="Rente mensuelle"
              value={formatCHF(dashboard.lpp.monthlyPension)}
            />
            <DashboardMetric
              label="Capacité de rachat"
              value={formatCHF(dashboard.lpp.buybackCapacity)}
            />
          </>
        ) : (
          <DashboardEmpty>Aucune donnée LPP exploitable.</DashboardEmpty>
        )}
      </DashboardCard>

      <DashboardCard
        title="3e pilier projeté"
        icon={PiggyBank}
        detailLink={{ to: "/calculators/pillar3a", search: linkSearch(clientId) }}
      >
        {dashboard.pillar3a ? (
          <>
            <DashboardMetric
              label="Plafond effectif"
              value={formatCHF(dashboard.pillar3a.effectiveCap)}
            />
            <DashboardMetric
              label="Capital projeté à 65 ans"
              value={formatCHF(dashboard.pillar3a.projectedCapitalAt65)}
              emphasis
            />
            <DashboardMetric
              label="Économie fiscale annuelle"
              value={formatCHF(dashboard.pillar3a.taxSavings)}
            />
          </>
        ) : (
          <DashboardEmpty>3a non applicable.</DashboardEmpty>
        )}
      </DashboardCard>

      <DashboardCard
        title="Rente vs capital"
        icon={Scale}
        detailLink={{ to: "/calculators/retirement", search: linkSearch(clientId) }}
      >
        {dashboard.retirement ? (
          <>
            <DashboardMetric
              label="Total rente (net, 20 ans)"
              value={formatCHF(dashboard.retirement.totalAnnuity)}
            />
            <DashboardMetric
              label="Total capital (net, 20 ans)"
              value={formatCHF(dashboard.retirement.totalLumpSum)}
            />
            <p className="mt-2 text-xs font-medium">
              Recommandation :{" "}
              <span className="text-primary">
                {dashboard.retirement.recommendation === "annuity"
                  ? "Rente"
                  : dashboard.retirement.recommendation === "lump_sum"
                    ? "Capital"
                    : "Mixte"}
              </span>
            </p>
          </>
        ) : (
          <DashboardEmpty>Capital LPP projeté insuffisant.</DashboardEmpty>
        )}
      </DashboardCard>

      <DashboardCard
        title="Rente AVS/AI (1er pilier)"
        icon={HeartHandshake}
        detailLink={{ to: "/calculators/avs-ai", search: linkSearch(clientId) }}
        hint={{
          tone: "info",
          text: "Estimation indicative. Pour un calcul officiel, demandez l'Extrait du Compte Individuel (CI) à votre caisse AVS.",
        }}
      >
        {dashboard.avs ? (
          <>
            <DashboardMetric
              label="Rente mensuelle estimée"
              value={formatCHF(dashboard.avs.monthlyPension)}
              emphasis
            />
            <DashboardMetric
              label="Rente annuelle"
              value={formatCHF(dashboard.avs.annualPension)}
            />
            <DashboardMetric
              label="Âge de référence"
              value={`${dashboard.avs.referenceAge} ans`}
            />
            <DashboardMetric
              label="Années de cotisation"
              value={`${dashboard.avs.effectiveYears} / 44`}
              sub={
                dashboard.avs.missingYears > 0
                  ? `${dashboard.avs.missingYears} manquantes`
                  : undefined
              }
            />
            {dashboard.avs.combinedMonthlyPension !== undefined && (
              <DashboardMetric
                label="Rente couple / mois"
                value={formatCHF(dashboard.avs.combinedMonthlyPension)}
                sub={dashboard.avs.cappedCouple ? "plafonnée" : undefined}
              />
            )}
          </>
        ) : (
          <DashboardEmpty>
            Renseignez la date de naissance et le salaire pour estimer la rente AVS.
          </DashboardEmpty>
        )}
      </DashboardCard>
    </div>
  );
}

// ─── PATRIMOINE ──────────────────────────────────────────────────────────

export function DashboardWealthSummary({ dashboard }: { dashboard: ClientDashboard }) {
  return (
    <DashboardCard title="Synthèse patrimoine" icon={Sparkles}>
      <DashboardMetric label="Fortune nette" value={formatCHF(dashboard.fortune)} emphasis />
      {dashboard.tax && (
        <DashboardMetric
          label="Impôt sur la fortune (incl.)"
          value={formatCHF(dashboard.tax.annualBurden)}
        />
      )}
    </DashboardCard>
  );
}

// ─── OPTIMISATIONS ───────────────────────────────────────────────────────

export function DashboardOptimizations({
  dashboard,
  clientFirstName,
}: {
  dashboard: ClientDashboard;
  clientFirstName: string;
}) {
  return (
    <OptimizationsPanel
      optimizations={dashboard.suggestions}
      title={`Optimisations pour ${clientFirstName}`}
      emptyHint="Complétez la fiche (canton, salaire, LPP, 3a, fortune) pour générer des recommandations chiffrées."
    />
  );
}
