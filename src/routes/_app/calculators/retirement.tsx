import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
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
      ? "Privilégier la rente : sécurité à vie + revenu garanti."
      : compare.recommendation === "lump_sum"
        ? "Privilégier le capital : meilleur rendement net après impôts si bien placé."
        : "Mixte recommandé : 50/50 capital + rente pour équilibrer sécurité et performance.";

  const { user } = useAuth();
  const handleExport = () =>
    exportRetirementPdf({
      header: { brokerEmail: user?.email ?? undefined },
      input: form,
      lumpTax,
      compare,
      reco,
    });
  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: "Bienvenue", body: "Compare la rente viagère LPP et le retrait du capital." },
    { title: "Taux de conversion", body: "Pour 2026 : 6.0 % sur la part obligatoire (en baisse continue). Vérifiez le taux de votre caisse." },
    { title: "Hypothèses", body: "Espérance de vie, rendement post-retraite, fiscalité du capital — paramètres clés du verdict." }
  ];



  return (
    <div className="space-y-6">
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title="Guide rente vs capital" />
      <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>


      {client && <ClientLinkBanner client={client} />}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="md:col-span-3">
          <CalcCard title="Hypothèses" description="Comparez le retrait en capital au versement en rente.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumField label="Capital LPP au moment de la retraite" value={form.capital} onChange={(v) => set("capital", v)} wikiId="lpp-conversion" wikiTip="Avoir LPP total disponible au départ à la retraite (obligatoire + surobligatoire)." />
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span>Canton de retrait</span>
                  <WikiTip articleId="lpp-conversion" tip="Canton de l'institution au moment du retrait — peut différer du domicile (ex. transfert vers Zoug)." />
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
                  Canton de l'institution au moment du retrait, qui peut différer du canton de domicile
                  (transfert vers une institution en canton à fiscalité favorable, ex. Zoug).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Situation civile</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as typeof form.status)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Célibataire</SelectItem>
                    <SelectItem value="married">Marié·e</SelectItem>
                    <SelectItem value="single_with_children">Famille monoparentale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <NumField label="Taux de conversion (%)" value={form.conversionRate} onChange={(v) => set("conversionRate", v)} step={0.05} wikiId="lpp-conversion" wikiTip="Taux légal 2026 : 6.8 %. Certaines caisses appliquent déjà 5.5 % sur la part surobligatoire." />
              <NumField label="Espérance de vie résiduelle (ans)" value={form.yearsAlive} onChange={(v) => set("yearsAlive", v)} wikiId="lpp-conversion" wikiTip="Durée de versement attendue de la rente. OFAS : ~22 ans à 65 ans hommes, ~24 ans femmes." />
              <NumField label="Rendement net du capital placé (%/an)" value={form.selfReturnRate} onChange={(v) => set("selfReturnRate", v)} step={0.1} wikiId="lpp-conversion" wikiTip="Hypothèse de rendement net si vous prenez le capital et l'investissez vous-même." />
              <NumField label="Taux marginal sur la rente (%)" value={form.rentMarginalRate} onChange={(v) => set("rentMarginalRate", v)} step={0.5} wikiId="lpp-conversion" wikiTip="La rente LPP est imposée à 100 % comme un revenu. Tranche marginale de votre revenu retraite total." />
            </div>
          </CalcCard>
        </div>
        <div className="space-y-4 md:col-span-2">
          <CalcCard title="Impôt unique sur capital (1/5 du barème)">
            <Row>
              <MoneyTile label="IFD" value={lumpTax.ifd} tip="Impôt fédéral direct, barème progressif fédéral identique dans toute la Suisse." />
              <MoneyTile label="Cantonal" value={lumpTax.cantonal} tip="Part cantonale de l'impôt sur le revenu (barème du canton)." />
            </Row>
            <div className="mt-3">
              <MoneyTile label="Total impôt capital" value={lumpTax.total} tone="warning" big tip="Total de l'impôt unique sur le retrait du capital de prévoyance." />
            </div>
          </CalcCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CalcCard title="Scénario rente">
          <Row>
            <MoneyTile label="Total brut versé" value={compare.totalRente} tip="Somme totale brute (salaire + dividendes) sortie de la société." />
            <MoneyTile label="Net après impôts" value={compare.netAnnuity} tone="primary" big tip="Montant qui reste après application des impôts." />
          </Row>
        </CalcCard>
        <CalcCard title="Scénario capital">
          <Row>
            <MoneyTile label="Capital après impôt" value={form.capital - lumpTax.total} tip="Capital net qui te reste après impôt unique sur le retrait." />
            <MoneyTile label="Net projeté" value={compare.netLumpSum} tone="primary" big tip="Capital net projeté à l'échéance, frais et impôts déduits." />
          </Row>
        </CalcCard>
      </div>

      <div className="rounded-2xl border border-success/30 bg-success/5 p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-success-foreground/80">Recommandation</div>
        <p className="mt-1 text-sm">{reco}</p>
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
