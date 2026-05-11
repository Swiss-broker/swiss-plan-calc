// Wizard partagé (création + édition) · 5 étapes.
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Save, Loader2, Plus, X } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumField } from "@/components/ui/num-field";
import { PhoneInput } from "@/components/ui/phone-input";
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
import { getSelectableCantons, isSelectableCanton, CANTON_BY_CODE } from "@/lib/swiss/cantons";
import {
  CIVIL_STATUS_LABELS,
  CONFESSION_LABELS,
  PERMIT_LABELS,
  TAX_STATUS_LABELS,
  WORK_STATUS_LABELS,
  LPP_PLAN_LABELS,
  SOURCE_TAX_SCALES,
  SOURCE_TAX_SCALE_LABELS,
  GENDER_LABELS,
  type CivilStatus,
  type Confession,
  type Permit,
  type TaxStatus,
  type WorkStatus,
  type LppPlan,
  type SourceTaxScale,
  type Gender,
} from "@/lib/swiss/enums";
import type { Child, Client } from "@/lib/clients/types";
import { getWorkStatusRules } from "@/lib/clients/work-status-rules";
import { suggestTaxStatus } from "@/lib/clients/suggest-tax-status";
import { formatCHF } from "@/lib/format";
import { computeLppInsuredSalary, LPP_COORDINATION_DEDUCTION_2026, LPP_MAX_INSURED_SALARY_2026 } from "@/lib/lpp";
import { CountryCombobox } from "@/components/ui/country-combobox";
import { CommuneAutocomplete } from "@/components/ui/commune-autocomplete";
import { useT } from "@/contexts/LanguageContext";

const STEP_IDS = [1, 2, 3, 4, 5] as const;
const STEP_KEYS = {
  1: { title: "wizard.step.identity.title", desc: "wizard.step.identity.desc" },
  2: { title: "wizard.step.fiscal.title", desc: "wizard.step.fiscal.desc" },
  3: { title: "wizard.step.activity.title", desc: "wizard.step.activity.desc" },
  4: { title: "wizard.step.family.title", desc: "wizard.step.family.desc" },
  5: { title: "wizard.step.patrimoine.title", desc: "wizard.step.patrimoine.desc" },
} as const;
const STEP_COUNT = 5;


export interface PensionAccount {
  institution: string;
  balance: number;
}

export interface WizardInitialData {
  client?: Client;
  pension?: {
    lpp_current_balance: number;
    lpp_insured_salary: number;
    lpp_max_buyback: number;
    lpp_plan: LppPlan;
    pillar_3a_annual_contribution: number;
    pillar_3a_accounts?: PensionAccount[];
    vested_benefits_accounts?: PensionAccount[];
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
  gender: Gender | "";
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
  arrival_year_ch: string;
  cross_border_start_year: string;
  avs_contribution_start_year: string;
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
  pillar_3a_accounts: PensionAccount[];
  vested_benefits_accounts: PensionAccount[];
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
    gender: (c?.gender as Gender | null) ?? "",
    email: c?.email ?? "",
    phone: c?.phone ?? "",
    nationality: c?.nationality ?? "CH",
    permit: c?.permit ?? "swiss",
    country_of_residence: c?.country_of_residence ?? "CH",
    canton: c?.canton ?? "",
    commune: c?.commune ?? "",
    postal_code: c?.postal_code ?? "",
    tax_status: c?.tax_status ?? "resident",
    source_tax_scale: (c?.source_tax_scale as SourceTaxScale | null) ?? "",
    confession: c?.confession ?? "none",
    parish: c?.parish ?? "",
    arrival_year_ch: c?.arrival_year_ch?.toString() ?? "",
    cross_border_start_year: c?.cross_border_start_year?.toString() ?? "",
    avs_contribution_start_year: c?.avs_contribution_start_year?.toString() ?? "",
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
    pillar_3a_accounts: parsePensionAccountsSafe(p?.pillar_3a_accounts),
    vested_benefits_accounts: parsePensionAccountsSafe(p?.vested_benefits_accounts),
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

function parsePensionAccountsSafe(value: unknown): PensionAccount[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => ({
      institution: typeof c.institution === "string" ? c.institution : "",
      balance: Number(c.balance ?? 0) || 0,
    }));
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
  const t = useT();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(() => initialForm(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Suggestion auto du statut fiscal : uniquement à la création, et seulement
  // tant que le courtier n'a pas modifié manuellement le champ. En édition,
  // on respecte intégralement la valeur existante.
  const taxStatusManuallyEdited = useRef<boolean>(mode === "edit");

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => {
      if (key === "tax_status") {
        taxStatusManuallyEdited.current = true;
      }
      if (key === "gross_annual_salary") {
        const gross = num(String(value)) ?? 0;
        return { ...s, [key]: value, lpp_insured_salary: String(computeLppInsuredSalary(gross)) };
      }
      return { ...s, [key]: value };
    });

  // Auto-suggestion en mode création : recalcule dès qu'un champ déterminant change.
  useEffect(() => {
    if (taxStatusManuallyEdited.current) return;
    const suggested = suggestTaxStatus({
      nationality: form.nationality,
      permit: form.permit,
      country_of_residence: form.country_of_residence,
      canton: form.canton,
    });
    if (suggested && suggested !== form.tax_status) {
      setForm((s) => ({ ...s, tax_status: suggested }));
    }
  }, [form.nationality, form.permit, form.country_of_residence, form.canton, form.tax_status]);

  const isMarried = form.civil_status === "married" || form.civil_status === "registered_partnership";

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error(t("wizard.toast.unauth"));
      const payload = {
        broker_id: user.id,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
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
        arrival_year_ch: form.arrival_year_ch ? parseInt(form.arrival_year_ch, 10) : null,
        cross_border_start_year: form.cross_border_start_year ? parseInt(form.cross_border_start_year, 10) : null,
        avs_contribution_start_year: form.avs_contribution_start_year ? parseInt(form.avs_contribution_start_year, 10) : null,
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
        children: form.children.filter(
          (c) => (c.first_name && c.first_name.trim() !== "") || (c.date_of_birth && c.date_of_birth.trim() !== ""),
        ) as unknown as import("@/integrations/supabase/types").Json,
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
        pillar_3a_accounts: form.pillar_3a_accounts.filter(
          (a) => a.institution.trim() !== "" || a.balance > 0,
        ) as unknown as import("@/integrations/supabase/types").Json,
        vested_benefits_accounts: form.vested_benefits_accounts.filter(
          (a) => a.institution.trim() !== "" || a.balance > 0,
        ) as unknown as import("@/integrations/supabase/types").Json,
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
      // Invalidation large : fiche, bundle (calculateurs), listes, vues d'édition.
      qc.invalidateQueries({ queryKey: ["client", savedId] });
      qc.invalidateQueries({ queryKey: ["client-bundle", savedId] });
      qc.invalidateQueries({ queryKey: ["client-edit", savedId] });
      qc.invalidateQueries({ queryKey: ["client-full", savedId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(mode === "edit" ? t("wizard.toast.updated") : t("wizard.toast.created"));
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
        const field = issue.path[0] as string;
        const errKey =
          field === "first_name"
            ? "wizard.error.first_name"
            : field === "last_name"
              ? "wizard.error.last_name"
              : field === "email"
                ? "wizard.error.email"
                : field === "canton"
                  ? "wizard.error.canton"
                  : null;
        errs[field] = errKey ? t(errKey) : issue.message;
      }
      setErrors(errs);
      return false;
    }
    setErrors({});
    return true;
  };

  const next = () => {
    if (!validateStep(step)) return;
    if (step < STEP_COUNT) setStep(step + 1);
  };
  const prev = () => step > 1 && setStep(step - 1);
  const submit = () => {
    for (let i = 1; i <= STEP_COUNT; i++) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }
    save.mutate();
  };

  const progress = useMemo(() => (step / STEP_COUNT) * 100, [step]);
  const currentTitle = t(STEP_KEYS[step as 1 | 2 | 3 | 4 | 5].title);
  const currentDesc = t(STEP_KEYS[step as 1 | 2 | 3 | 4 | 5].desc);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {mode === "edit" ? t("wizard.title.edit") : t("wizard.title.new")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("wizard.step_of", { step, total: STEP_COUNT })} · {currentTitle}
            <span className="text-muted-foreground/70"> · {currentDesc}</span>
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate({ to: "/clients" })}>
          {t("common.cancel")}
        </Button>
      </div>

      <Progress value={progress} className="mt-4 h-1.5" />

      <div className="mt-6 hidden grid-cols-5 gap-2 sm:grid">
        {STEP_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setStep(id)}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
              id === step
                ? "border-primary bg-primary/5"
                : id < step
                  ? "border-border bg-muted/40"
                  : "border-border bg-card"
            }`}
          >
            <div className="font-semibold">{id}. {t(STEP_KEYS[id].title)}</div>
            <div className="mt-0.5 text-muted-foreground">{t(STEP_KEYS[id].desc)}</div>
          </button>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        {step === 1 && <StepIdentity form={form} update={update} errors={errors} />}
        {step === 2 && <StepFiscal form={form} update={update} errors={errors} />}
        {step === 3 && <StepActivity form={form} update={update} />}
        {step === 4 && <StepFamily form={form} update={update} isMarried={isMarried} />}
        {step === 5 && <StepPatrimoine form={form} update={update} workStatus={form.work_status} />}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="outline" onClick={prev} disabled={step === 1}>
          <ChevronLeft className="h-4 w-4" /> {t("common.previous")}
        </Button>
        {step < STEP_COUNT ? (
          <Button onClick={next}>
            {t("common.next")} <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={save.isPending} className="shadow-elegant">
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {mode === "edit" ? t("wizard.btn.save") : t("wizard.btn.create")}
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
  const t = useT();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t("wizard.field.first_name")} htmlFor="fn" error={errors?.first_name}>
        <Input
          id="fn"
          value={form.first_name}
          onChange={(e) => update("first_name", e.target.value)}
          maxLength={80}
        />
      </Field>
      <Field label={t("wizard.field.last_name")} htmlFor="ln" error={errors?.last_name}>
        <Input
          id="ln"
          value={form.last_name}
          onChange={(e) => update("last_name", e.target.value)}
          maxLength={80}
        />
      </Field>
      <Field label={t("wizard.field.dob")} htmlFor="dob">
        <Input
          id="dob"
          type="date"
          value={form.date_of_birth}
          onChange={(e) => update("date_of_birth", e.target.value)}
        />
      </Field>
      <Field label={t("wizard.field.gender")}>
        <Select
          value={form.gender || "unset"}
          onValueChange={(v) => update("gender", v === "unset" ? "" : (v as Gender))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unset">{t("wizard.field.gender.unset")}</SelectItem>
            {Object.entries(GENDER_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("wizard.field.nationality")} htmlFor="nat">
        <CountryCombobox
          id="nat"
          value={form.nationality}
          onChange={(code) => update("nationality", code)}
        />
      </Field>
      <Field label={t("wizard.field.email")} htmlFor="em" error={errors?.email}>
        <Input
          id="em"
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          maxLength={255}
        />
      </Field>
      <Field label={t("wizard.field.phone")} htmlFor="ph">
        <PhoneInput id="ph" value={form.phone} onChange={(v) => update("phone", v)} />
      </Field>
      <Field label={t("wizard.field.permit")}>
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
  const t = useT();
  const isSource =
    form.tax_status === "source_taxed" ||
    form.tax_status === "cross_border_fr_1983" ||
    form.tax_status === "cross_border_ge" ||
    form.tax_status === "tou";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t("wizard.field.country_residence")} htmlFor="cor">
        <CountryCombobox
          id="cor"
          value={form.country_of_residence}
          onChange={(code) => update("country_of_residence", code)}
        />
      </Field>
      <Field
        label={t("wizard.field.canton_work")}
        error={errors?.canton}
        hint={
          form.canton && !isSelectableCanton(form.canton)
            ? t("wizard.field.canton.warn", { code: form.canton })
            : undefined
        }
      >
        <Select value={form.canton} onValueChange={(v) => update("canton", v)}>
          <SelectTrigger>
            <SelectValue placeholder={t("wizard.field.canton.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {getSelectableCantons().map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} · {c.name}
              </SelectItem>
            ))}
            {form.canton && !isSelectableCanton(form.canton) && (
              <SelectItem value={form.canton} disabled>
                {form.canton} ·{" "}
                {CANTON_BY_CODE[form.canton]?.name ?? form.canton} {t("wizard.field.canton.out_of_scope")}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </Field>
      <Field
        label={t("wizard.field.commune")}
        htmlFor="com"
        hint={form.canton ? t("wizard.field.commune.hint") : undefined}
      >
        <CommuneAutocomplete
          id="com"
          value={form.commune}
          onChange={(v) => update("commune", v)}
          canton={form.canton}
        />
      </Field>
      <Field label={t("wizard.field.npa")} htmlFor="npa">
        <Input
          id="npa"
          value={form.postal_code}
          onChange={(e) => update("postal_code", e.target.value)}
          maxLength={10}
        />
      </Field>
      <Field label={t("wizard.field.tax_status")}>
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
        <Field label={t("wizard.field.source_scale")} hint={t("wizard.field.source_scale.hint")}>
          <Select
            value={form.source_tax_scale}
            onValueChange={(v) => update("source_tax_scale", v as SourceTaxScale)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("wizard.field.source_scale.placeholder")} />
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
      <Field label={t("wizard.field.confession")}>
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
      <Field label={t("wizard.field.parish")} htmlFor="par">
        <Input
          id="par"
          value={form.parish}
          onChange={(e) => update("parish", e.target.value)}
          maxLength={80}
        />
      </Field>

      {/* Années — résident / frontalier / cotisation AVS */}
      <Field
        label={t("wizard.field.arrival_year_ch")}
        htmlFor="arr_year"
        hint={t("wizard.field.arrival_year_ch.hint")}
      >
        <Input
          id="arr_year"
          type="number"
          inputMode="numeric"
          min={1900}
          max={new Date().getFullYear()}
          placeholder="2018"
          value={form.arrival_year_ch}
          onChange={(e) => update("arrival_year_ch", e.target.value)}
        />
      </Field>
      <Field
        label={t("wizard.field.cross_border_start_year")}
        htmlFor="cb_year"
        hint={t("wizard.field.cross_border_start_year.hint")}
      >
        <Input
          id="cb_year"
          type="number"
          inputMode="numeric"
          min={1900}
          max={new Date().getFullYear()}
          placeholder="2015"
          value={form.cross_border_start_year}
          onChange={(e) => update("cross_border_start_year", e.target.value)}
        />
      </Field>
      <Field
        label={t("wizard.field.avs_contribution_start_year")}
        htmlFor="avs_year"
        hint={t("wizard.field.avs_contribution_start_year.hint")}
      >
        <Input
          id="avs_year"
          type="number"
          inputMode="numeric"
          min={1900}
          max={new Date().getFullYear()}
          placeholder={t("wizard.field.avs_contribution_start_year.placeholder")}
          value={form.avs_contribution_start_year}
          onChange={(e) => update("avs_contribution_start_year", e.target.value)}
        />
      </Field>
    </div>
  );
}

function StepActivity({ form, update }: StepProps) {
  const t = useT();
  const rules = getWorkStatusRules(form.work_status);
  const salaryLabel = rules.isSelfEmployed && form.work_status === "self_employed"
    ? t("wizard.field.salary.self")
    : rules.isRetired
      ? t("wizard.field.salary.retired")
      : t("wizard.field.salary.employee");
  const otherIncomeLabel = rules.isRetired
    ? t("wizard.field.other_income.retired")
    : t("wizard.field.other_income");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t("wizard.field.work_status")}>
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
      {rules.hasSalary && (
        <Field label={t("wizard.field.activity_rate")} htmlFor="ar">
          <NumField
            id="ar"
            value={form.activity_rate}
            onChange={(v) => update("activity_rate", v)}
            suffix="%"
          />
        </Field>
      )}
      {rules.hasSalary && !rules.isSelfEmployed && (
        <Field label={t("wizard.field.employer")} htmlFor="emp">
          <Input
            id="emp"
            value={form.employer}
            onChange={(e) => update("employer", e.target.value)}
            maxLength={120}
          />
        </Field>
      )}
      {(rules.hasSalary || rules.isSelfEmployed || rules.isRetired) && (
        <Field label={salaryLabel} htmlFor="sal">
          <NumField
            id="sal"
            value={form.gross_annual_salary}
            onChange={(v) => update("gross_annual_salary", v)}
            suffix="CHF"
          />
        </Field>
      )}
      {rules.hasSalary && !rules.isSelfEmployed && (
        <Field label={t("wizard.field.bonus")} htmlFor="bn">
          <NumField
            id="bn"
            value={form.bonus}
            onChange={(v) => update("bonus", v)}
            suffix="CHF"
          />
        </Field>
      )}
      <Field label={otherIncomeLabel} htmlFor="oi">
        <NumField
          id="oi"
          value={form.other_income}
          onChange={(v) => update("other_income", v)}
          suffix="CHF"
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
  const t = useT();
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
        <Field label={t("wizard.field.civil_status")}>
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
            <h3 className="text-sm font-semibold">{t("wizard.spouse.title")}</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label={t("wizard.spouse.first_name")}>
                <Input
                  value={form.spouse_first_name}
                  onChange={(e) => update("spouse_first_name", e.target.value)}
                  maxLength={80}
                />
              </Field>
              <Field label={t("wizard.spouse.last_name")}>
                <Input
                  value={form.spouse_last_name}
                  onChange={(e) => update("spouse_last_name", e.target.value)}
                  maxLength={80}
                />
              </Field>
              <Field label={t("wizard.spouse.dob")}>
                <Input
                  type="date"
                  value={form.spouse_date_of_birth}
                  onChange={(e) => update("spouse_date_of_birth", e.target.value)}
                />
              </Field>
              <Field label={t("wizard.spouse.salary")}>
                <NumField
                  value={form.spouse_gross_annual_salary}
                  onChange={(v) => update("spouse_gross_annual_salary", v)}
                  suffix="CHF"
                />
              </Field>
            </div>
          </div>
        </>
      )}

      <Separator />
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("wizard.children.title")}</h3>
          <Button type="button" variant="outline" size="sm" onClick={addChild}>
            <Plus className="h-4 w-4" /> {t("wizard.children.add")}
          </Button>
        </div>
        {form.children.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("wizard.children.empty")}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {form.children.map((c, i) => (
              <div key={i} className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
                <Input
                  value={c.first_name}
                  onChange={(e) => updateChild(i, { first_name: e.target.value })}
                  placeholder={t("wizard.children.first_name.placeholder")}
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
                  {t("wizard.children.in_household")}
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

function StepPatrimoine({
  form,
  update,
  workStatus,
}: StepProps & { workStatus: WorkStatus }) {
  const t = useT();
  const rules = getWorkStatusRules(workStatus);
  const shortLabel = t(`enum.work_status.${workStatus}`);
  const netSelfIncome = Number(form.gross_annual_salary) || 0;
  const cap3a = rules.hasLPP
    ? rules.pillar3aCap
    : rules.isSelfEmployed
      ? Math.min(rules.pillar3aCap, Math.round(netSelfIncome * 0.2))
      : rules.pillar3aCap;

  return (
    <div className="space-y-6">
      {rules.hasLPP ? (
        <div>
          <h3 className="text-sm font-semibold">{t("wizard.lpp.title")}</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label={t("wizard.lpp.balance")}>
              <NumField
                value={form.lpp_current_balance}
                onChange={(v) => update("lpp_current_balance", v)}
                suffix="CHF"
              />
            </Field>
            <Field label={t("wizard.lpp.insured")}>
              <NumField
                value={form.lpp_insured_salary}
                onChange={(v) => update("lpp_insured_salary", v)}
                suffix="CHF"
              />
            </Field>
            {rules.canBuybackLPP && (
              <Field label={t("wizard.lpp.buyback")} hint={t("wizard.lpp.buyback.hint")}>
                <NumField
                  value={form.lpp_max_buyback}
                  onChange={(v) => update("lpp_max_buyback", v)}
                  suffix="CHF"
                />
              </Field>
            )}
            <Field label={t("wizard.lpp.plan")}>
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
      ) : !rules.isRetired ? (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-3 text-xs text-muted-foreground">
          {t("wizard.lpp.no_aff", { label: shortLabel })}
          {rules.isSelfEmployed ? t("wizard.lpp.self_optional") : ""}
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold">{t("wizard.lpp.title_retired")}</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label={t("wizard.lpp.balance_remaining")}>
              <NumField
                value={form.lpp_current_balance}
                onChange={(v) => update("lpp_current_balance", v)}
                suffix="CHF"
              />
            </Field>
          </div>
        </div>
      )}

      <Separator />
      {cap3a > 0 ? (
        <div>
          <h3 className="text-sm font-semibold">{t("wizard.p3a.title")}</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field
              label={t("wizard.p3a.contribution")}
              hint={t("wizard.p3a.cap_hint", { label: shortLabel.toLowerCase(), amount: formatCHF(cap3a) })}
            >
              <NumField
                value={form.pillar_3a_annual_contribution}
                onChange={(v) => update("pillar_3a_annual_contribution", v)}
                suffix="CHF"
              />
            </Field>
          </div>
          <PensionAccountsEditor
            label={t("wizard.p3a.accounts.label")}
            hint={t("wizard.p3a.accounts.hint")}
            value={form.pillar_3a_accounts}
            onChange={(v) => update("pillar_3a_accounts", v)}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-3 text-xs text-muted-foreground">
          {t("wizard.p3a.not_applicable", { label: shortLabel })}
          {rules.isRetired ? t("wizard.p3a.reason.retired") : t("wizard.p3a.reason.no_income")}.
        </div>
      )}

      <Separator />
      <div>
        <h3 className="text-sm font-semibold">{t("wizard.vested.title")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("wizard.vested.desc")}
        </p>
        <PensionAccountsEditor
          value={form.vested_benefits_accounts}
          onChange={(v) => update("vested_benefits_accounts", v)}
        />
      </div>

      <Separator />
      <div>
        <h3 className="text-sm font-semibold">{t("wizard.assets.title")}</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label={t("wizard.assets.bank")}>
            <NumField
              value={form.bank_accounts}
              onChange={(v) => update("bank_accounts", v)}
              suffix="CHF"
            />
          </Field>
          <Field label={t("wizard.assets.securities")}>
            <NumField
              value={form.securities}
              onChange={(v) => update("securities", v)}
              suffix="CHF"
            />
          </Field>
          <Field label={t("wizard.assets.realestate")}>
            <NumField
              value={form.real_estate_value}
              onChange={(v) => update("real_estate_value", v)}
              suffix="CHF"
            />
          </Field>
          <Field label={t("wizard.assets.mortgage")}>
            <NumField
              value={form.mortgage_debt}
              onChange={(v) => update("mortgage_debt", v)}
              suffix="CHF"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function PensionAccountsEditor({
  value,
  onChange,
  label,
  hint,
}: {
  value: PensionAccount[];
  onChange: (v: PensionAccount[]) => void;
  label?: string;
  hint?: string;
}) {
  const t = useT();
  const total = value.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const add = () => onChange([...value, { institution: "", balance: 0 }]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const patch = (i: number, p: Partial<PensionAccount>) =>
    onChange(value.map((a, idx) => (idx === i ? { ...a, ...p } : a)));

  return (
    <div className="mt-4 space-y-2">
      {label && <div className="text-xs font-medium text-muted-foreground">{label}</div>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {value.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">{t("wizard.accounts.empty")}</p>
      ) : (
        <div className="space-y-2">
          {value.map((a, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-[11px] text-muted-foreground">{t("wizard.accounts.institution")}</Label>
                <Input
                  value={a.institution}
                  onChange={(e) => patch(i, { institution: e.target.value })}
                  placeholder={t("wizard.accounts.institution.placeholder")}
                />
              </div>
              <div className="w-40">
                <Label className="text-[11px] text-muted-foreground">{t("wizard.accounts.balance")}</Label>
                <NumField
                  value={String(a.balance || "")}
                  onChange={(v) => patch(i, { balance: Number(v) || 0 })}
                  suffix="CHF"
                />
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="text-right text-xs text-muted-foreground">
            {t("wizard.accounts.total")} <span className="font-medium text-foreground">{formatCHF(total)}</span>
          </div>
        </div>
      )}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5" /> {t("wizard.accounts.add")}
      </Button>
    </div>
  );
}

