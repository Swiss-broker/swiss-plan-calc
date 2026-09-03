// src/routes/_app/calculators/fx-claim.tsx
// Calculateur, Analyse réclamation fiscale liée au taux de change.
// Compare le taux AFC (annuel) au taux marché (BNS/ECB) à la date de chaque versement.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Plus, Trash2, RefreshCw, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { CalcCard, MoneyTile, PctTile, StatTile } from "@/components/calculators/CalcUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCHF } from "@/lib/format";
import {
  analyzeFxClaim,
  type FxClaimInput,
  type FxTransaction,
} from "@/lib/fx/analyze";
import { AFC_ANNUAL_RATES, SUPPORTED_CURRENCIES, type Currency } from "@/lib/fx/sources";
import { fetchMarketRates } from "@/lib/fx/fetch.functions";
import { useBrokerPdfHeader } from "@/hooks/useBrokerPdfHeader";
import { exportFxClaimPdf } from "@/lib/pdf/fx-claim-report";
import { CrossCalcImpactBanner } from "@/components/calculators/CrossCalcImpactBanner";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useLoadSavedSimulation } from "@/hooks/useLoadSavedSimulation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Client } from "@/lib/clients/types";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
  simId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/fx-claim")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [{ title: "Réclamation taux de change · SwissBroker Pro" }],
  }),
  component: FxClaimCalc,
});

const YEARS = Object.keys(AFC_ANNUAL_RATES)
  .map(Number)
  .sort((a, b) => b - a);

const MONTH_NAMES_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function newRow(date: string): FxTransaction {
  return { date, amount: 0, currency: "EUR", marketRate: 0, label: "" };
}

// Ajoute `months` mois à une date "YYYY-MM-DD" en conservant le jour du mois
// (repose sur JS pour l'ajustement automatique des débordements d'année).
function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y || new Date().getFullYear(), (m || 1) - 1 + months, d || 15);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function FxClaimCalc() {
  const { clientId, simId } = Route.useSearch();
  const { inputs: savedInputs, isLoading: loadingSaved } = useLoadSavedSimulation(simId);
  const { data: client } = useQuery({
    queryKey: ["fx-claim-client", clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();
      if (error) throw error;
      return data as Client;
    },
  });
  const header = useBrokerPdfHeader();
  const [taxYear, setTaxYear] = useState<number>(2024);
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [marginalRate, setMarginalRate] = useState<number>(28);
  const [afcOverride, setAfcOverride] = useState<string>("");
  const [rows, setRows] = useState<FxTransaction[]>(() => [
    { ...newRow(`${2024}-03-15`), amount: 8000, label: "Salaire mars" },
    { ...newRow(`${2024}-06-15`), amount: 8000, label: "Salaire juin" },
    { ...newRow(`${2024}-09-15`), amount: 8000, label: "Salaire septembre" },
    { ...newRow(`${2024}-12-15`), amount: 8000, label: "Salaire décembre" },
  ]);
  const [bulkStartMonth, setBulkStartMonth] = useState<number>(1);
  const [bulkSalary, setBulkSalary] = useState<number>(8000);
  const [loading, setLoading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  // Rechargement d'une analyse sauvegardée : ne s'applique qu'une fois par
  // simId, pour ne pas écraser les modifications faites après le chargement.
  // Sans cet effet, "Ouvrir" un versement sauvegardé rouvrait la page vide,
  // comme si l'analyse n'avait jamais existé.
  const loadedSimRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!simId || !savedInputs) return;
    if (loadedSimRef.current === simId) return;
    loadedSimRef.current = simId;
    const savedTaxYear = Number(savedInputs.taxYear);
    const savedCurrency = savedInputs.currency as Currency | undefined;
    if (Number.isFinite(savedTaxYear) && savedTaxYear > 0) setTaxYear(savedTaxYear);
    if (savedCurrency) setCurrency(savedCurrency);
    if (Number.isFinite(Number(savedInputs.marginalRate))) setMarginalRate(Number(savedInputs.marginalRate));
    const officialRate =
      savedCurrency && Number.isFinite(savedTaxYear) ? AFC_ANNUAL_RATES[savedTaxYear]?.[savedCurrency] : undefined;
    const savedRate = Number(savedInputs.afcRate);
    setAfcOverride(
      Number.isFinite(savedRate) && savedRate > 0 && savedRate !== officialRate ? String(savedRate) : "",
    );
    const savedTransactions = Array.isArray(savedInputs.transactions)
      ? (savedInputs.transactions as FxTransaction[])
      : [];
    if (savedTransactions.length > 0) setRows(savedTransactions);
  }, [simId, savedInputs]);

  const afcRate = useMemo(() => {
    const override = parseFloat(afcOverride.replace(",", "."));
    if (Number.isFinite(override) && override > 0) return override;
    return AFC_ANNUAL_RATES[taxYear]?.[currency] ?? 1;
  }, [afcOverride, taxYear, currency]);

  const input: FxClaimInput = useMemo(
    () => ({
      taxYear,
      afcRate,
      currency,
      transactions: rows
        .filter((r) => r.amount > 0 && r.date)
        .map((r) => ({ ...r, currency })),
      marginalRate,
    }),
    [taxYear, afcRate, currency, rows, marginalRate],
  );

  const result = useMemo(() => analyzeFxClaim(input), [input]);

  const guideSteps: GuideStep[] = [
    {
      title: "Bienvenue sur le calculateur Réclamation taux de change",
      body: "Comparez le taux de change officiel AFC (utilisé par le fisc français) au taux réel du marché, pour identifier un éventuel trop-payé d'impôt à réclamer.",
    },
    {
      target: "fx-claim-params",
      title: "Paramètres généraux",
      body: "Choisissez l'année fiscale et la devise. Le taux AFC officiel se remplit automatiquement, mais vous pouvez le forcer manuellement si besoin.",
    },
    {
      target: "fx-claim-rows",
      title: "Versements du client",
      body: "Ajoutez chaque versement de salaire avec sa date exacte. Le bouton \"Récupérer les taux\" va chercher automatiquement le taux réel du marché pour chaque date, via la Banque centrale européenne.",
    },
    {
      target: "fx-claim-result",
      title: "Résultat de l'analyse",
      body: "L'écart en faveur du client et l'économie d'impôt estimée s'affichent ici, recalculés en direct à chaque modification.",
    },
    {
      target: "fx-claim-export",
      title: "Générer le courrier ou sauvegarder",
      body: "« Générer le courrier PDF » produit directement le courrier de réclamation prêt à envoyer à l'administration fiscale. « Sauvegarder » rattache cette analyse à la fiche du client, pour qu'elle apparaisse dans sa synthèse RDV comme les autres calculateurs.",
    },
  ];

  const updateRow = (i: number, patch: Partial<FxTransaction>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  // Suggère la date suivante (mois +1 après le dernier versement) et
  // reprend le montant du dernier versement : le salaire d'un même
  // employeur ne change presque jamais d'un mois sur l'autre, autant éviter
  // de tout ressaisir à la main.
  const addRow = () =>
    setRows((rs) => {
      const last = rs[rs.length - 1];
      if (!last) return [...rs, newRow(`${taxYear}-01-15`)];
      const nextDate = addMonths(last.date || `${taxYear}-01-15`, 1);
      const month = Number(nextDate.slice(5, 7)) - 1;
      return [...rs, { ...newRow(nextDate), amount: last.amount, label: `Salaire ${MONTH_NAMES_FR[month]}` }];
    });

  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  // Génère les 12 versements mensuels d'un coup à partir d'un mois de
  // départ et d'un salaire type, plutôt que d'ajouter les lignes une par
  // une : le cas le plus courant (salaire mensuel stable sur l'année) n'a
  // ensuite plus qu'à être ajusté sur les quelques mois qui diffèrent.
  const generateTwelveMonths = () => {
    const generated: FxTransaction[] = Array.from({ length: 12 }, (_, i) => {
      const monthIndex = (bulkStartMonth - 1 + i) % 12;
      const yearOffset = Math.floor((bulkStartMonth - 1 + i) / 12);
      const date = `${taxYear + yearOffset}-${String(monthIndex + 1).padStart(2, "0")}-15`;
      return { ...newRow(date), amount: bulkSalary, label: `Salaire ${MONTH_NAMES_FR[monthIndex]}` };
    });
    setRows(generated);
    toast.success("12 versements mensuels générés — ajustez les montants qui diffèrent.");
  };

  const fillMarketRates = async () => {
    const dates = rows.map((r) => r.date).filter(Boolean);
    if (dates.length === 0) {
      toast.error("Aucune date à remplir.");
      return;
    }
    setLoading(true);
    try {
      const fetched = await fetchMarketRates({ data: { dates, currency } });
      const map = new Map(fetched.map((r) => [r.date, r]));
      const missing: string[] = [];
      const shifted: string[] = [];
      setRows((rs) =>
        rs.map((r) => {
          const entry = map.get(r.date);
          if (!entry || entry.rate === null || entry.rate === undefined) {
            missing.push(r.date);
            return r;
          }
          if (entry.effectiveDate && entry.effectiveDate !== r.date) {
            shifted.push(`${r.date} → ${entry.effectiveDate}`);
          }
          return { ...r, marketRate: entry.rate };
        }),
      );
      if (missing.length) {
        toast.warning(`Taux non récupérés pour ${missing.length} date(s), saisie manuelle.`);
      } else {
        toast.success(`Taux ${currency}/CHF récupérés via ECB.`);
      }
      if (shifted.length) {
        toast.info(`${shifted.length} date(s) repliée(s) sur le jour ouvrable précédent (week-end/férié).`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur récupération taux");
    } finally {
      setLoading(false);
    }
  };

  const onExport = () => {
    if (result.lines.length === 0) {
      toast.error("Ajoutez au moins un versement avec un montant et un taux.");
      return;
    }
    exportFxClaimPdf({ header, input, result });
  };

  const surplus = result.totalDeltaChf > 0;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      <div className="md:col-span-5 flex items-center justify-between gap-3">
        <div className="flex-1"><CrossCalcImpactBanner calculator="fx-claim" clientId={clientId} /></div>
        <GuideToggleButton onClick={() => setGuideOpen(true)} />
      </div>
      <GuideMode
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        steps={guideSteps}
        title="Guide, Réclamation taux de change"
        guideId="calc-fx-claim"
      />
      {simId && loadingSaved && (
        <div className="md:col-span-5 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Chargement de l'analyse sauvegardée…
        </div>
      )}
      {client && (
        <div className="md:col-span-5">
          <ClientLinkBanner client={client} />
        </div>
      )}
      <div className="md:col-span-3 space-y-4">
        <div data-guide="fx-claim-params">
          <CalcCard
            title="Paramètres généraux"
            description="Le fisc français applique un taux de change annuel moyen (taux AFC) pour convertir vos revenus CHF en euros. Si le taux réel du jour était plus favorable, vous avez peut-être trop déclaré."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Année fiscale</Label>
                <Select value={String(taxYear)} onValueChange={(v) => setTaxYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Devise</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Taux marginal d'impôt (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={marginalRate}
                  onChange={(e) => setMarginalRate(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">
                  Taux AFC retenu{" "}
                  {AFC_ANNUAL_RATES[taxYear]?.[currency] != null ? (
                    <span className="text-success">
                     , officiel {taxYear} : {(AFC_ANNUAL_RATES[taxYear]![currency] ?? 0).toFixed(4)} CHF/{currency} = {(1 / (AFC_ANNUAL_RATES[taxYear]![currency] ?? 1)).toFixed(4)} {currency}/CHF
                    </span>
                  ) : (
                    <span className="text-warning">
                     , taux AFC non publié pour {currency} en {taxYear}, saisir manuellement
                    </span>
                  )}
                </Label>
                <Input
                  placeholder="Laisser vide pour utiliser le taux officiel AFC"
                  value={afcOverride}
                  onChange={(e) => setAfcOverride(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 flex items-end">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Taux journalier réel</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={fillMarketRates}
                    disabled={loading}
                    title="Récupère automatiquement le taux de change réel du jour de chaque versement via la Banque Centrale Européenne"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    {loading ? "Récupération..." : "Récupérer les taux"}
                  </Button>
                </div>
              </div>
            </div>
          </CalcCard>
        </div>

        <div data-guide="fx-claim-rows">
          <CalcCard
            title="Versements"
            description="Saisissez vos versements en CHF (salaire suisse). Le calculateur compare le taux fiscal officiel au taux réel du jour de versement pour estimer un éventuel trop-payé d'impôt en France."
          >
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Mois de départ</Label>
                <Select value={String(bulkStartMonth)} onValueChange={(v) => setBulkStartMonth(Number(v))}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES_FR.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Salaire mensuel CHF</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="w-[140px]"
                  value={bulkSalary || ""}
                  onChange={(e) => setBulkSalary(Number(e.target.value) || 0)}
                />
              </div>
              <Button type="button" variant="outline" onClick={generateTwelveMonths}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Générer 12 mois
              </Button>
              <p className="text-xs text-muted-foreground">
                Remplace les versements ci-dessous par 12 lignes mensuelles, même montant, à ajuster ensuite si un mois diffère.
              </p>
            </div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs text-foreground">
                <strong>La colonne « Taux BNS/ECB » ne se remplit pas toute seule</strong> : cliquez sur « Récupérer les taux » pour aller chercher automatiquement le taux réel de chaque date de versement, ou saisissez-le vous-même.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fillMarketRates}
                disabled={loading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Récupération..." : "Récupérer les taux"}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[130px]">Date</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="w-[120px]">Montant CHF</TableHead>
                    <TableHead className="w-[110px]">Taux BNS/ECB</TableHead>
                    <TableHead className="w-[120px] text-right">Écart en euros</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => {
                    const deltaChf = r.amount * (afcRate - r.marketRate);
                    const deltaEur = r.marketRate > 0 ? deltaChf / r.marketRate : 0;
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <Input
                            type="date"
                            value={r.date}
                            onChange={(e) => updateRow(i, { date: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.label || ""}
                            onChange={(e) => updateRow(i, { label: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={r.amount || ""}
                            onChange={(e) => updateRow(i, { amount: Number(e.target.value) || 0 })}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              type="text"
                              value={r.marketRate ? r.marketRate.toFixed(4) : ""}
                              onChange={(e) => updateRow(i, { marketRate: parseFloat(e.target.value.replace(",", ".")) || 0 })}
                              placeholder="Auto"
                              className={r.marketRate ? "border-success/50 bg-success/5" : ""}
                            />
                          </div>
                        </TableCell>
                        <TableCell className={`text-right tabular-nums ${deltaEur > 0 ? "text-success" : deltaEur < 0 ? "text-warning" : ""}`}>
                          {deltaEur !== 0 ? deltaEur.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(i)}
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un versement
              </Button>
              <div className="flex flex-wrap items-center gap-2" data-guide="fx-claim-export">
                <SaveSimulationButton
                  kind="fx_claim"
                  inputs={{
                    taxYear,
                    currency,
                    marginalRate,
                    afcRate,
                    transactions: input.transactions,
                    transactionCount: input.transactions.length,
                  }}
                  summary={{
                    totalChfAfc: result.totalChfAfc,
                    totalChfMarket: result.totalChfMarket,
                    totalDeltaChf: result.totalDeltaChf,
                    estimatedTaxRefund: result.estimatedTaxRefund,
                    deltaRelativePct: result.deltaRelativePct,
                    weightedMarketRate: result.weightedMarketRate,
                  }}
                  defaultTitle={`Taux de change ${currency} · ${taxYear}`}
                />
                <Button type="button" onClick={onExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Générer le courrier PDF
                </Button>
              </div>
            </div>
          </CalcCard>
        </div>
      </div>

      <div className="md:col-span-2 space-y-4">
        <div data-guide="fx-claim-result">
          <CalcCard title="Résultat de l'analyse">
            <div className="grid grid-cols-2 gap-3">
              <MoneyTile label="CHF retenu (AFC)" value={result.totalChfAfc} tone="warning" />
              <MoneyTile label="CHF réel (marché)" value={result.totalChfMarket} tone="primary" />
              <MoneyTile
                label="Écart en faveur du client"
                value={result.totalDeltaChf}
                tone={surplus ? "success" : "default"}
                big
              />
              <MoneyTile
                label="Économie d'impôt estimée"
                value={result.estimatedTaxRefund}
                tone={surplus ? "success" : "default"}
                big
              />
              <PctTile label="Écart relatif AFC vs marché" value={result.deltaRelativePct} />
              <StatTile
                label="Taux marché pondéré"
                value={`${result.weightedMarketRate.toFixed(4)} CHF/${currency}`}
              />
            </div>
          </CalcCard>
        </div>

        <CalcCard title="Notes" description="Sources et fondement juridique">
          <ul className="text-xs text-muted-foreground space-y-2 leading-relaxed">
            <li>
              <strong>AFC</strong>, taux moyens annuels publiés par l'Administration fédérale
              des contributions (notices officielles, base de la conversion par défaut).
            </li>
            <li>
              <strong>BNS / ECB</strong>, taux journaliers de référence récupérés via
              api.frankfurter.app (proxy ECB, sans clé). Les taux BNS officiels (data.snb.ch)
              peuvent être substitués pour les pièces jointes.
            </li>
            <li className="flex gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
              <span>
                Une réclamation n'est admise que si le contribuable peut prouver la date exacte
                de chaque versement (fiches de salaire, relevés bancaires).
              </span>
            </li>
          </ul>
        </CalcCard>
      </div>
    </div>
  );
}