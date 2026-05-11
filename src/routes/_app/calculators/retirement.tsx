import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useClientFiscalSnapshot } from "@/hooks/useClientFiscalSnapshot";
import { NumField as BaseNumField } from "@/components/ui/num-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getWithdrawalCantons } from "@/lib/swiss/cantons";
import { annuityVsLumpSum, capitalWithdrawalTax } from "@/lib/lpp";
import { CalcCard, MoneyTile, Row } from "@/components/calculators/CalcUI";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { exportRetirementPdf } from "@/lib/pdf/reports";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useAuth } from "@/contexts/AuthContext";
import { useBrokerPdfHeader } from "@/hooks/useBrokerPdfHeader";
import { useT } from "@/contexts/LanguageContext";

import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { WikiTip } from "@/components/calculators/WikiTip";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/retirement")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Rente vs capital · SwissBroker Pro" }] }),
  component: RetirementCalc,
});

function RetirementCalc() {
  const t = useT();
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "retirement");
  const [form, setForm] = useState({
    capital: 600_000,
    canton: "VD",
    status: "single" as "single" | "married" | "single_with_children",
    conversionRate: 6.0,
    yearsAlive: 22,
    selfReturnRate: 2.5,
    rentMarginalRate: 25,
  });
  useHydrateFormFromPrefill(prefill, setForm);

  // Pré-remplir le taux marginal depuis la dernière simulation fiscale du client
  const { data: snapshot } = useClientFiscalSnapshot(clientId);
  const marginalAutofilled = useRef(false);
  useEffect(() => {
    if (snapshot && !marginalAutofilled.current) {
      setForm((f) => ({ ...f, rentMarginalRate: Math.round(snapshot.marginalRateEstimate * 10) / 10 }));
      marginalAutofilled.current = true;
    }
  }, [snapshot]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const lumpTax = useMemo(
    () => capitalWithdrawalTax({ capital: form.capital, canton: form.canton, status: form.status }),
    [form],
  );

  const compare = useMemo(
    () =>
      annuityVsLumpSum({
        capital: form.capital,
        conversionRate: form.conversionRate,
        yearsAlive: form.yearsAlive,
        selfReturnRate: form.selfReturnRate,
        rentMarginalRate: form.rentMarginalRate,
        lumpSumTax: lumpTax.total,
      }),
    [form, lumpTax.total],
  );

  const reco =
    compare.recommendation === "annuity"
      ? t("calc.retirement.reco.annuity")
      : compare.recommendation === "lump_sum"
        ? t("calc.retirement.reco.lump")
        : t("calc.retirement.reco.mixed");

  const { user } = useAuth();
  const brokerHeader = useBrokerPdfHeader();
  const handleExport = () =>
    exportRetirementPdf({
      header: brokerHeader,
      input: form,
      lumpTax,
      compare,
      reco,
    });
  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: t("calc.retirement.guide.s1.title"), body: t("calc.retirement.guide.s1.body") },
    { title: t("calc.retirement.guide.s2.title"), body: t("calc.retirement.guide.s2.body") },
    { title: t("calc.retirement.guide.s3.title"), body: t("calc.retirement.guide.s3.body") },
  ];

  return (
    <div className="space-y-6">
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title={t("calc.retirement.guide.title")} />
      <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>

      {client && <ClientLinkBanner client={client} />}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="md:col-span-3">
          <CalcCard title={t("calc.retirement.section.title")} description={t("calc.retirement.section.desc")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumField label={t("calc.retirement.field.capital")} value={form.capital} onChange={(v) => set("capital", v)} wikiId="lpp-conversion" wikiTip={t("calc.retirement.tip.capital")} />
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span>{t("calc.retirement.field.canton")}</span>
                  <WikiTip articleId="lpp-conversion" tip={t("calc.retirement.tip.canton")} />
                </Label>
                <Select value={form.canton} onValueChange={(v) => set("canton", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getWithdrawalCantons().map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {t("calc.retirement.note.canton")}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t("calc.retirement.field.civil_status")}</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as typeof form.status)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">{t("calc.status.single")}</SelectItem>
                    <SelectItem value="married">{t("calc.status.married")}</SelectItem>
                    <SelectItem value="single_with_children">{t("calc.status.single_with_children")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <NumField label={t("calc.retirement.field.conversion_rate")} value={form.conversionRate} onChange={(v) => set("conversionRate", v)} step={0.05} wikiId="lpp-conversion" wikiTip={t("calc.retirement.tip.conversion_rate")} />
              <NumField label={t("calc.retirement.field.life_years")} value={form.yearsAlive} onChange={(v) => set("yearsAlive", v)} wikiId="lpp-conversion" wikiTip={t("calc.retirement.tip.life_years")} />
              <NumField label={t("calc.retirement.field.return_rate")} value={form.selfReturnRate} onChange={(v) => set("selfReturnRate", v)} step={0.1} wikiId="lpp-conversion" wikiTip={t("calc.retirement.tip.return_rate")} />
              <div className="space-y-1">
                <NumField label={t("calc.retirement.field.marginal_rate")} value={form.rentMarginalRate} onChange={(v) => set("rentMarginalRate", v)} step={0.5} suffix="%" wikiId="lpp-conversion" wikiTip="Le taux marginal correspond à l'impôt prélevé sur chaque franc supplémentaire de revenu (ici, la rente LPP), en fonction de la situation fiscale globale du client. Estimé depuis sa situation actuelle, ajustez selon vos hypothèses pour la retraite." />
                <p className="text-[10px] text-muted-foreground">
                  {snapshot
                    ? `Estimé depuis la dernière simulation (taux moyen ${snapshot.averageRate.toFixed(1)} %, marge sécurité +5 pts). Modifiable.`
                    : "Hypothèse standard 25 %. Ajustez selon le profil retraite du client."}
                </p>
              </div>
            </div>
          </CalcCard>
        </div>
        <div className="space-y-4 md:col-span-2">
          <CalcCard title={t("calc.retirement.lump_tax.title")}>
            <Row>
              <MoneyTile label={t("calc.income_tax.tile.ifd")} value={lumpTax.ifd} tip={t("calc.income_tax.tip.ifd")} />
              <MoneyTile label={t("calc.income_tax.tile.cantonal")} value={lumpTax.cantonal} tip={t("calc.income_tax.tip.cantonal")} />
            </Row>
            <div className="mt-3">
              <MoneyTile label={t("calc.retirement.lump_tax.total")} value={lumpTax.total} tone="warning" big tip={t("calc.retirement.lump_tax.total.tip")} />
            </div>
          </CalcCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CalcCard title={t("calc.retirement.scen.annuity")}>
          <Row>
            <MoneyTile label={t("calc.retirement.scen.annuity.gross")} value={compare.totalRente} tip={t("calc.retirement.scen.annuity.gross.tip")} />
            <MoneyTile label={t("calc.retirement.scen.annuity.net")} value={compare.netAnnuity} tone="primary" big tip={t("calc.retirement.scen.annuity.net.tip")} />
          </Row>
        </CalcCard>
        <CalcCard title={t("calc.retirement.scen.lump")}>
          <Row>
            <MoneyTile label={t("calc.retirement.scen.lump.after_tax")} value={form.capital - lumpTax.total} tip={t("calc.retirement.scen.lump.after_tax.tip")} />
            <MoneyTile label={t("calc.retirement.scen.lump.projected")} value={compare.netLumpSum} tone="primary" big tip={t("calc.retirement.scen.lump.projected.tip")} />
          </Row>
        </CalcCard>
      </div>

      <div className="rounded-2xl border border-success/30 bg-success/5 p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-success-foreground/80">{t("calc.retirement.reco.title")}</div>
        <p className="mt-1 text-sm">{reco}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Cette comparaison repose sur les hypothèses ci-dessus (espérance de vie, rendement, fiscalité). Une modification de ces paramètres peut changer la recommandation.
        </p>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <SaveSimulationButton
          kind="retirement"
          inputs={form}
          summary={{
            netAnnuity: compare.netAnnuity,
            netLumpSum: compare.netLumpSum,
            lumpTaxTotal: lumpTax.total,
            recommendation: compare.recommendation,
          }}
          defaultTitle={`Retraite ${form.canton} · capital ${form.capital}`}
        />
        <ExportPdfButton onClick={handleExport} />
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step: _step = 1,
  suffix,
  wikiId,
  wikiTip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
  wikiId?: string;
  wikiTip?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {wikiId && wikiTip ? <WikiTip articleId={wikiId} tip={wikiTip} /> : null}
      </Label>
      <BaseNumField
        value={String(value)}
        onChange={(v) => onChange(Number(v) || 0)}
        suffix={suffix}
      />
    </div>
  );
}
