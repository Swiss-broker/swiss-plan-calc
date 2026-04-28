// Wizard partagé (création + édition) · 5 étapes.
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Save, Loader2, Plus, X } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CANTONS } from "@/lib/swiss/cantons";
import {
  CIVIL_STATUS_LABELS,
  CONFESSION_LABELS,
  PERMIT_LABELS,
  TAX_STATUS_LABELS,
  WORK_STATUS_LABELS,
  LPP_PLAN_LABELS,
  SOURCE_TAX_SCALES,
  SOURCE_TAX_SCALE_LABELS,
  type CivilStatus,
  type Confession,
  type Permit,
  type TaxStatus,
  type WorkStatus,
  type LppPlan,
  type SourceTaxScale,
} from "@/lib/swiss/enums";
import type { Child, Client } from "@/lib/clients/types";

const STEPS = [
  { id: 1, title: "Identité", desc: "Informations personnelles" },
  { id: 2, title: "Fiscalité", desc: "Domicile et imposition" },
  { id: 3, title: "Activité", desc: "Profession et revenus" },
  { id: 4, title: "Famille", desc: "Conjoint et enfants" },
  { id: 5, title: "Patrimoine & prévoyance", desc: "LPP, 3a, fortune" },
] as const;

export interface WizardInitialData {
  client?: Client;
  pension?: {
    lpp_current_balance: number;
    lpp_insured_salary: number;
    lpp_max_buyback: number;
    lpp_plan: LppPlan;
    pillar_3a_annual_contribution: number;
  };
  assets?: {
    bank_accounts: number;
    securities: number;
    real_estate_value: number;
    mortgage_debt: number;
  };
}

interface FormState {
  // Identity
  first_name: string;
  last_name: string;
  date_of_birth: string;
  email: string;
  phone: string;
  nationality: string;
  permit: Permit;
  // Fiscal
  country_of_residence: string;
  canton: string;
  commune: string;
  postal_code: string;
  tax_status: TaxStatus;
  source_tax_scale: SourceTaxScale | "";
  confession: Confession;
  parish: string;
  // Activity
  work_status: WorkStatus;
  activity_rate: string;
  employer: string;
  gross_annual_salary: string;
  bonus: string;
  other_income: string;
  // Family
  civil_status: CivilStatus;
  spouse_first_name: string;
  spouse_last_name: string;
  spouse_date_of_birth: string;
  spouse_gross_annual_salary: string;
  children: Child[];
  // Pension & assets (optional shortcuts)
  lpp_current_balance: string;
  lpp_insured_salary: string;
  lpp_max_buyback: string;
  lpp_plan: LppPlan;
  pillar_3a_annual_contribution: string;
  bank_accounts: string;
  securities: string;
  real_estate_value: string;
  mortgage_debt: string;
}

function initialForm(initial?: WizardInitialData): FormState {
  const c = initial?.client;
  const p = initial?.pension;
  const a = initial?.assets;
  return {
    first_name: c?.first_name ?? "",
    last_name: c?.last_name ?? "",
    date_of_birth: c?.date_of_birth ?? "",
    email: c?.email ?? "",
    phone: c?.phone ?? "",
    nationality: c?.nationality ?? "CH",
    permit: c?.permit ?? "swiss",
    country_of_residence: c?.country_of_residence ?? "CH",
    canton: c?.canton ?? "",
    commune: c?.commune ?? "",
    postal_code: c?.postal_code ?? "",
    tax_status: c?.tax_status ?? "ordinary_resident",
    source_tax_scale: (c?.source_tax_scale as SourceTaxScale | null) ?? "",
    confession: c?.confession ?? "none",
    parish: c?.parish ?? "",
    work_status: c?.work_status ?? "employee",
    activity_rate: c?.activity_rate?.toString() ?? "100",
    employer: c?.employer ?? "",
    gross_annual_salary: c?.gross_annual_salary?.toString() ?? "",
    bonus: c?.bonus?.toString() ?? "",
    other_income: c?.other_income?.toString() ?? "",
    civil_status: c?.civil_status ?? "single",
    spouse_first_name: c?.spouse_first_name ?? "",
    spouse_last_name: c?.spouse_last_name ?? "",
    spouse_date_of_birth: c?.spouse_date_of_birth ?? "",
    spouse_gross_annual_salary: c?.spouse_gross_annual_salary?.toString() ?? "",
    children: parseChildrenSafe(c?.children),
    lpp_current_balance: p?.lpp_current_balance?.toString() ?? "",
    lpp_insured_salary: p?.lpp_insured_salary?.toString() ?? "",
    lpp_max_buyback: p?.lpp_max_buyback?.toString() ?? "",
    lpp_plan: p?.lpp_plan ?? "mandatory",
    pillar_3a_annual_contribution: p?.pillar_3a_annual_contribution?.toString() ?? "",
    bank_accounts: a?.bank_accounts?.toString() ?? "",
    securities: a?.securities?.toString() ?? "",
    real_estate_value: a?.real_estate_value?.toString() ?? "",
    mortgage_debt: a?.mortgage_debt?.toString() ?? "",
  };
}

function parseChildrenSafe(value: unknown): Child[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (c): c is Child =>
      typeof c === "object" && c !== null && typeof (c as Child).first_name === "string",
  );
}

const stepSchemas = {
  1: z.object({
    first_name: z.string().trim().min(1, "Prénom requis").max(80),
    last_name: z.string().trim().min(1, "Nom requis").max(80),
    email: z.string().trim().email("Email invalide").max(255).or(z.literal("")),
  }),
  2: z.object({
    canton: z.string().min(2, "Canton requis"),
  }),
  3: z.object({}),
  4: z.object({}),
  5: z.object({}),
} as const;

function num(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.replace(/[\s']/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export interface ClientWizardProps {
  initial?: WizardInitialData;
  mode: "create" | "edit";
  clientId?: string;
}

export function ClientWizard({ initial, mode, clientId }: ClientWizardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(() => initialForm(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const isMarried = form.civil_status === "married" || form.civil_status === "registered_partnership";

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non authentifié");
      const payload = {
        broker_id: user.id,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        date_of_birth: form.date_of_birth || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        nationality: form.nationality || null,
        permit: form.permit,
        country_of_residence: form.country_of_residence || null,
        canton: form.canton || null,
        commune: form.commune || null,
        postal_code: form.postal_code || null,
        tax_status: form.tax_status,
        source_tax_scale: form.source_tax_scale || null,
        confession: form.confession,
        parish: form.parish || null,
        work_status: form.work_status,
        activity_rate: num(form.activity_rate),
        employer: form.employer || null,
        gross_annual_salary: num(form.gross_annual_salary),
        bonus: num(form.bonus),
        other_income: num(form.other_income),
        civil_status: form.civil_status,
        spouse_first_name: isMarried ? form.spouse_first_name || null : null,
        spouse_last_name: isMarried ? form.spouse_last_name || null : null,
        spouse_date_of_birth: isMarried ? form.spouse_date_of_birth || null : null,
        spouse_gross_annual_salary: isMarried ? num(form.spouse_gross_annual_salary) : null,
        children: form.children as unknown as import("@/integrations/supabase/types").Json,
      };

      let savedId: string;
      if (mode === "edit" && clientId) {
        const { error } = await supabase.from("clients").update(payload).eq("id", clientId);
        if (error) throw error;
        savedId = clientId;
      } else {
        const { data, error } = await supabase
          .from("clients")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        savedId = data.id;
      }

      // Pension upsert
      const pensionPayload = {
        broker_id: user.id,
        client_id: savedId,
        lpp_current_balance: num(form.lpp_current_balance) ?? 0,
        lpp_insured_salary: num(form.lpp_insured_salary) ?? 0,
        lpp_max_buyback: num(form.lpp_max_buyback) ?? 0,
        lpp_plan: form.lpp_plan,
        pillar_3a_annual_contribution: num(form.pillar_3a_annual_contribution) ?? 0,
      };
      const { data: existingPension } = await supabase
        .from("client_pension")
        .select("id")
        .eq("client_id", savedId)
        .maybeSingle();
      if (existingPension) {
        await supabase.from("client_pension").update(pensionPayload).eq("id", existingPension.id);
      } else {
        await supabase.from("client_pension").insert(pensionPayload);
      }

      // Assets upsert
      const assetsPayload = {
        broker_id: user.id,
        client_id: savedId,
        bank_accounts: num(form.bank_accounts) ?? 0,
        securities: num(form.securities) ?? 0,
        real_estate_value: num(form.real_estate_value) ?? 0,
        mortgage_debt: num(form.mortgage_debt) ?? 0,
      };
      const { data: existingAssets } = await supabase
        .from("client_assets")
        .select("id")
        .eq("client_id", savedId)
        .maybeSingle();
      if (existingAssets) {
        await supabase.from("client_assets").update(assetsPayload).eq("id", existingAssets.id);
      } else {
        await supabase.from("client_assets").insert(assetsPayload);
      }

      return savedId;
    },
    onSuccess: (savedId) => {
      toast.success(mode === "edit" ? "Client mis à jour" : "Client créé");
      navigate({ to: "/clients/$clientId", params: { clientId: savedId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const validateStep = (n: number): boolean => {
    const schema = stepSchemas[n as keyof typeof stepSchemas];
    const result = schema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errs[issue.path[0] as string] = issue.message;
      }
      setErrors(errs);
      return false;
    }
    setErrors({});
    return true;
  };

  const next = () => {
    if (!validateStep(step)) return;
    if (step < STEPS.length) setStep(step + 1);
  };
  const prev = () => step > 1 && setStep(step - 1);
  const submit = () => {
    for (let i = 1; i <= STEPS.length; i++) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }
    save.mutate();
  };

  const progress = useMemo(() => (step / STEPS.length) * 100, [step]);
  const current = STEPS[step - 1];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {mode === "edit" ? "Modifier le client" : "Nouveau client"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Étape {step} sur {STEPS.length} · {current.title}
            <span className="text-muted-foreground/70"> · {current.desc}</span>
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate({ to: "/clients" })}>
          Annuler
        </Button>
      </div>

      <Progress value={progress} className="mt-4 h-1.5" />

      <div className="mt-6 hidden grid-cols-5 gap-2 sm:grid">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
              s.id === step
                ? "border-primary bg-primary/5"
                : s.id < step
                  ? "border-border bg-muted/40"
                  : "border-border bg-card"
            }`}
          >
            <div className="font-semibold">{s.id}. {s.title}</div>
            <div className="mt-0.5 text-muted-foreground">{s.desc}</div>
          </button>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        {step === 1 && <StepIdentity form={form} update={update} errors={errors} />}
        {step === 2 && <StepFiscal form={form} update={update} errors={errors} />}
        {step === 3 && <StepActivity form={form} update={update} />}
        {step === 4 && <StepFamily form={form} update={update} isMarried={isMarried} />}
        {step === 5 && <StepPatrimoine form={form} update={update} />}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="outline" onClick={prev} disabled={step === 1}>
          <ChevronLeft className="h-4 w-4" /> Précédent
        </Button>
        {step < STEPS.length ? (
          <Button onClick={next}>
            Suivant <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={save.isPending} className="shadow-elegant">
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {mode === "edit" ? "Enregistrer" : "Créer le dossier"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* --------------------- STEPS --------------------- */

interface StepProps {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  errors?: Record<string, string>;
}

function Field({
  label,
  htmlFor,
  error,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function StepIdentity({ form, update, errors }: StepProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Prénom" htmlFor="fn" error={errors?.first_name}>
        <Input
          id="fn"
          value={form.first_name}
          onChange={(e) => update("first_name", e.target.value)}
          maxLength={80}
        />
      </Field>
      <Field label="Nom" htmlFor="ln" error={errors?.last_name}>
        <Input
          id="ln"
          value={form.last_name}
          onChange={(e) => update("last_name", e.target.value)}
          maxLength={80}
        />
      </Field>
      <Field label="Date de naissance" htmlFor="dob">
        <Input
          id="dob"
          type="date"
          value={form.date_of_birth}
          onChange={(e) => update("date_of_birth", e.target.value)}
        />
      </Field>
      <Field label="Nationalité" htmlFor="nat">
        <Input
          id="nat"
          value={form.nationality}
          onChange={(e) => update("nationality", e.target.value.toUpperCase())}
          maxLength={3}
          placeholder="CH"
        />
      </Field>
      <Field label="Email" htmlFor="em" error={errors?.email}>
        <Input
          id="em"
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          maxLength={255}
        />
      </Field>
      <Field label="Téléphone" htmlFor="ph">
        <Input
          id="ph"
          type="tel"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          maxLength={40}
        />
      </Field>
      <Field label="Permis de séjour">
        <Select value={form.permit} onValueChange={(v) => update("permit", v as Permit)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERMIT_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function StepFiscal({ form, update, errors }: StepProps) {
  const isSource =
    form.tax_status === "source_taxed" ||
    form.tax_status === "cross_border_g" ||
    form.tax_status === "quasi_resident";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Pays de résidence" htmlFor="cor">
        <Input
          id="cor"
          value={form.country_of_residence}
          onChange={(e) => update("country_of_residence", e.target.value.toUpperCase())}
          maxLength={3}
          placeholder="CH / FR / DE / IT"
        />
      </Field>
      <Field label="Canton de travail" error={errors?.canton}>
        <Select value={form.canton} onValueChange={(v) => update("canton", v)}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un canton" />
          </SelectTrigger>
          <SelectContent>
            {CANTONS.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} · {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Commune" htmlFor="com">
        <Input
          id="com"
          value={form.commune}
          onChange={(e) => update("commune", e.target.value)}
          maxLength={80}
        />
      </Field>
      <Field label="Code postal (NPA)" htmlFor="npa">
        <Input
          id="npa"
          value={form.postal_code}
          onChange={(e) => update("postal_code", e.target.value)}
          maxLength={10}
        />
      </Field>
      <Field label="Statut fiscal">
        <Select
          value={form.tax_status}
          onValueChange={(v) => update("tax_status", v as TaxStatus)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TAX_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {isSource ? (
        <Field label="Barème impôt à la source" hint="Sélectionner selon situation familiale">
          <Select
            value={form.source_tax_scale}
            onValueChange={(v) => update("source_tax_scale", v as SourceTaxScale)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_TAX_SCALES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_TAX_SCALE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : (
        <div />
      )}
      <Field label="Confession">
        <Select
          value={form.confession}
          onValueChange={(v) => update("confession", v as Confession)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CONFESSION_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Paroisse (si pertinent)" htmlFor="par">
        <Input
          id="par"
          value={form.parish}
          onChange={(e) => update("parish", e.target.value)}
          maxLength={80}
        />
      </Field>
    </div>
  );
}

function StepActivity({ form, update }: StepProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Statut professionnel">
        <Select
          value={form.work_status}
          onValueChange={(v) => update("work_status", v as WorkStatus)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(WORK_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Taux d'activité (%)" htmlFor="ar">
        <Input
          id="ar"
          type="number"
          min={0}
          max={100}
          value={form.activity_rate}
          onChange={(e) => update("activity_rate", e.target.value)}
        />
      </Field>
      <Field label="Employeur" htmlFor="emp">
        <Input
          id="emp"
          value={form.employer}
          onChange={(e) => update("employer", e.target.value)}
          maxLength={120}
        />
      </Field>
      <Field label="Salaire annuel brut (CHF)" htmlFor="sal">
        <Input
          id="sal"
          inputMode="decimal"
          value={form.gross_annual_salary}
          onChange={(e) => update("gross_annual_salary", e.target.value)}
        />
      </Field>
      <Field label="Bonus / 13e (CHF)" htmlFor="bn">
        <Input
          id="bn"
          inputMode="decimal"
          value={form.bonus}
          onChange={(e) => update("bonus", e.target.value)}
        />
      </Field>
      <Field label="Autres revenus (CHF)" htmlFor="oi">
        <Input
          id="oi"
          inputMode="decimal"
          value={form.other_income}
          onChange={(e) => update("other_income", e.target.value)}
        />
      </Field>
    </div>
  );
}

function StepFamily({
  form,
  update,
  isMarried,
}: StepProps & { isMarried: boolean }) {
  const addChild = () =>
    update("children", [
      ...form.children,
      { first_name: "", date_of_birth: "", in_household: true },
    ]);
  const removeChild = (i: number) =>
    update(
      "children",
      form.children.filter((_, idx) => idx !== i),
    );
  const updateChild = (i: number, patch: Partial<Child>) =>
    update(
      "children",
      form.children.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="État civil">
          <Select
            value={form.civil_status}
            onValueChange={(v) => update("civil_status", v as CivilStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CIVIL_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {isMarried && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-semibold">Conjoint</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Prénom du conjoint">
                <Input
                  value={form.spouse_first_name}
                  onChange={(e) => update("spouse_first_name", e.target.value)}
                  maxLength={80}
                />
              </Field>
              <Field label="Nom du conjoint">
                <Input
                  value={form.spouse_last_name}
                  onChange={(e) => update("spouse_last_name", e.target.value)}
                  maxLength={80}
                />
              </Field>
              <Field label="Date de naissance">
                <Input
                  type="date"
                  value={form.spouse_date_of_birth}
                  onChange={(e) => update("spouse_date_of_birth", e.target.value)}
                />
              </Field>
              <Field label="Salaire annuel brut conjoint (CHF)">
                <Input
                  inputMode="decimal"
                  value={form.spouse_gross_annual_salary}
                  onChange={(e) => update("spouse_gross_annual_salary", e.target.value)}
                />
              </Field>
            </div>
          </div>
        </>
      )}

      <Separator />
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Enfants à charge</h3>
          <Button type="button" variant="outline" size="sm" onClick={addChild}>
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </div>
        {form.children.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Aucun enfant · ajoutez les enfants à charge pour ajuster les déductions fiscales.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {form.children.map((c, i) => (
              <div key={i} className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
                <Input
                  value={c.first_name}
                  onChange={(e) => updateChild(i, { first_name: e.target.value })}
                  placeholder="Prénom"
                  maxLength={80}
                />
                <Input
                  type="date"
                  value={c.date_of_birth}
                  onChange={(e) => updateChild(i, { date_of_birth: e.target.value })}
                />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={c.in_household}
                    onCheckedChange={(v) => updateChild(i, { in_household: !!v })}
                  />
                  Au foyer
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeChild(i)}
                  className="text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StepPatrimoine({ form, update }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold">2e pilier (LPP)</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Avoir LPP actuel (CHF)">
            <Input
              inputMode="decimal"
              value={form.lpp_current_balance}
              onChange={(e) => update("lpp_current_balance", e.target.value)}
            />
          </Field>
          <Field label="Salaire assuré LPP (CHF)">
            <Input
              inputMode="decimal"
              value={form.lpp_insured_salary}
              onChange={(e) => update("lpp_insured_salary", e.target.value)}
            />
          </Field>
          <Field label="Capacité de rachat LPP (CHF)" hint="Maximum mentionné par la caisse">
            <Input
              inputMode="decimal"
              value={form.lpp_max_buyback}
              onChange={(e) => update("lpp_max_buyback", e.target.value)}
            />
          </Field>
          <Field label="Plan LPP">
            <Select value={form.lpp_plan} onValueChange={(v) => update("lpp_plan", v as LppPlan)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LPP_PLAN_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      <Separator />
      <div>
        <h3 className="text-sm font-semibold">3e pilier (3a)</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Versement annuel 3a (CHF)" hint="Plafond 2026 salarié : 7'258 CHF">
            <Input
              inputMode="decimal"
              value={form.pillar_3a_annual_contribution}
              onChange={(e) => update("pillar_3a_annual_contribution", e.target.value)}
            />
          </Field>
        </div>
      </div>

      <Separator />
      <div>
        <h3 className="text-sm font-semibold">Patrimoine</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Comptes bancaires (CHF)">
            <Input
              inputMode="decimal"
              value={form.bank_accounts}
              onChange={(e) => update("bank_accounts", e.target.value)}
            />
          </Field>
          <Field label="Titres / portefeuille (CHF)">
            <Input
              inputMode="decimal"
              value={form.securities}
              onChange={(e) => update("securities", e.target.value)}
            />
          </Field>
          <Field label="Bien immobilier (valeur fiscale CHF)">
            <Input
              inputMode="decimal"
              value={form.real_estate_value}
              onChange={(e) => update("real_estate_value", e.target.value)}
            />
          </Field>
          <Field label="Dette hypothécaire (CHF)">
            <Input
              inputMode="decimal"
              value={form.mortgage_debt}
              onChange={(e) => update("mortgage_debt", e.target.value)}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
