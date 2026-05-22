// Calculateur, Analyse réclamation fiscale liée au taux de change.
// Compare le taux AFC (annuel) au taux marché (BNS/ECB) à la date de chaque versement.

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
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

function newRow(date: string): FxTransaction {
  return { date, amount: 0, currency: "EUR", marketRate: 0, label: "" };
}

function FxClaimCalc() {
  const { clientId } = Route.useSearch();
  const header = useBrokerPdfHeader();
  const fetchRates = useServerFn(fetchMarketRates);
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
  const [loading, setLoading] = useState(false);

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

  const updateRow = (i: number, patch: Partial<FxTransaction>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((rs) => [...rs, newRow(`${taxYear}-${String(rs.length + 1).padStart(2, "0")}-15`)]);

  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const fillMarketRates = async () => {
    const dates = rows.map((r) => r.date).filter(Boolean);
    if (dates.length === 0) {
      toast.error("Aucune date à remplir.");
      return;
    }
    setLoading(true);
    try {
      const fetched = await fetchRates({ data: { dates, currency } });
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
      <div className="md:col-span-5"><CrossCalcImpactBanner calculator="fx-claim" clientId={clientId} /></div>
      <div className="md:col-span-3 space-y-4">
        <CalcCard
          title="Paramètres généraux"
          description="Le taux AFC est appliqué uniformément ; le taux BNS/ECB reflète la valeur réelle à la date de versement."
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
                   , officiel {taxYear} : {(AFC_ANNUAL_RATES[taxYear]![currency] ?? 0).toFixed(4)} CHF/{currency}
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
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={fillMarketRates}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Taux BNS/ECB
              </Button>
            </div>
          </div>
        </CalcCard>

        <CalcCard
          title="Versements"
          description="Listez chaque versement perçu en devise étrangère pendant l'année fiscale."
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Date</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="w-[120px]">Montant {currency}</TableHead>
                  <TableHead className="w-[110px]">Taux BNS/ECB</TableHead>
                  <TableHead className="w-[120px] text-right">Écart CHF</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const delta = r.amount * (afcRate - r.marketRate);
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
                        <Input
                          type="number"
                          step="0.0001"
                          value={r.marketRate || ""}
                          onChange={(e) => updateRow(i, { marketRate: Number(e.target.value) || 0 })}
                        />
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${delta > 0 ? "text-success" : delta < 0 ? "text-warning" : ""}`}>
                        {formatCHF(delta)}
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
          <div className="mt-3 flex justify-between">
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un versement
            </Button>
            <Button type="button" onClick={onExport}>
              <Download className="h-4 w-4 mr-2" />
              Générer le courrier PDF
            </Button>
          </div>
        </CalcCard>
      </div>

      <div className="md:col-span-2 space-y-4">
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
