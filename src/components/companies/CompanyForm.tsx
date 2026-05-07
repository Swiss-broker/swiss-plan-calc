import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Coins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NumField } from "@/components/ui/num-field";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CANTONS } from "@/lib/swiss/cantons";
import {
  IDE_REGEX,
  LEGAL_FORM_OPTIONS,
  normalizeIde,
  type Company,
  type LegalForm,
} from "@/lib/companies/types";

const currentYear = new Date().getFullYear();

const schema = z.object({
  legal_name: z.string().trim().min(1, "Raison sociale obligatoire"),
  legal_form: z.enum(["sarl", "sa", "cooperative", "association", "other"]),
  ide_number: z
    .string()
    .optional()
    .refine((v) => !v || !v.trim() || IDE_REGEX.test(v.trim()), "Format attendu : CHE-XXX.XXX.XXX"),
  vat_number: z.string().optional(),
  canton: z.string().optional(),
  founding_year: z
    .string()
    .optional()
    .refine((v) => {
      if (!v || !v.trim()) return true;
      const n = Number(v);
      return Number.isInteger(n) && n >= 1800 && n <= currentYear + 1;
    }, `Année entre 1800 et ${currentYear + 1}`),
  annual_revenue: z.string().optional(),
  annual_profit: z.string().optional(),
  retained_earnings: z.string().optional(),
  headcount_fte: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function toNum(v: string | undefined): number | null {
  if (!v || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function fromNum(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : String(n);
}

export interface CompanyFormProps {
  mode: "create" | "edit";
  initial?: Company;
}

export function CompanyForm({ mode, initial }: CompanyFormProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      legal_name: initial?.legal_name ?? "",
      legal_form: (initial?.legal_form as LegalForm) ?? "sarl",
      ide_number: initial?.ide_number ?? "",
      vat_number: initial?.vat_number ?? "",
      canton: initial?.canton ?? "",
      founding_year: initial?.founding_year ? String(initial.founding_year) : "",
      annual_revenue: fromNum(initial?.annual_revenue),
      annual_profit: fromNum(initial?.annual_profit),
      retained_earnings: fromNum(initial?.retained_earnings),
      headcount_fte: fromNum((initial as Company & { headcount_fte?: number | null })?.headcount_fte ?? null),
      notes: initial?.notes ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (raw: FormValues) => {
      const parsed = schema.parse(raw);
      const payload = {
        legal_name: parsed.legal_name,
        legal_form: parsed.legal_form,
        ide_number: parsed.ide_number?.trim() ? normalizeIde(parsed.ide_number.trim()) : null,
        vat_number: parsed.vat_number?.trim() ? parsed.vat_number.trim() : null,
        canton: parsed.canton?.trim() ? parsed.canton.trim() : null,
        founding_year: parsed.founding_year?.trim() ? Number(parsed.founding_year) : null,
        annual_revenue: toNum(raw.annual_revenue),
        annual_profit: toNum(raw.annual_profit),
        retained_earnings: toNum(raw.retained_earnings),
        notes: parsed.notes?.trim() ? parsed.notes.trim() : null,
      };

      if (mode === "create") {
        if (!user) throw new Error("Non authentifié");
        const { data, error } = await supabase
          .from("companies")
          .insert({ ...payload, broker_id: user.id })
          .select()
          .single();
        if (error) throw error;
        return data as Company;
      }

      if (!initial) throw new Error("Société introuvable");
      const { data, error } = await supabase
        .from("companies")
        .update(payload)
        .eq("id", initial.id)
        .select()
        .single();
      if (error) throw error;
      return data as Company;
    },
    onSuccess: (company) => {
      toast.success(mode === "create" ? "Société créée" : "Modifications enregistrées");
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["company", company.id] });
      navigate({ to: "/companies/$companyId", params: { companyId: company.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectableCantons = CANTONS.filter((c) => c.selectable);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6 lg:px-8"
      >
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              mode === "edit" && initial
                ? navigate({ to: "/companies/$companyId", params: { companyId: initial.id } })
                : navigate({ to: "/companies" })
            }
          >
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {mode === "create" ? "Nouvelle société" : "Modifier la société"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Identité juridique et données financières annuelles. Les dirigeants se rattachent
            ensuite depuis leur fiche client.
          </p>
        </div>

        {/* Identité */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <header className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Identité</h2>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="legal_name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Raison sociale *</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Sàrl" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="legal_form"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forme juridique *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEGAL_FORM_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="canton"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Canton du siège</FormLabel>
                  <Select
                    value={field.value || ""}
                    onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Non renseigné</SelectItem>
                      {selectableCantons.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} · {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ide_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numéro IDE</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="CHE-123.456.789"
                      {...field}
                      onBlur={(e) => {
                        const norm = normalizeIde(e.target.value);
                        if (norm && norm !== e.target.value) field.onChange(norm);
                        field.onBlur();
                      }}
                    />
                  </FormControl>
                  <FormDescription>Format suisse : CHE-XXX.XXX.XXX</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vat_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numéro TVA</FormLabel>
                  <FormControl>
                    <Input placeholder="CHE-123.456.789 TVA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="founding_year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Année de fondation</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder={String(currentYear)}
                      min={1800}
                      max={currentYear + 1}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* Finances */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <header className="mb-4 flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Données financières</h2>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="annual_revenue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chiffre d'affaires annuel</FormLabel>
                  <FormControl>
                    <NumField value={field.value ?? ""} onChange={field.onChange} suffix="CHF" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="annual_profit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bénéfice annuel</FormLabel>
                  <FormControl>
                    <NumField value={field.value ?? ""} onChange={field.onChange} suffix="CHF" />
                  </FormControl>
                  <FormDescription>Avant distribution éventuelle de dividende.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="retained_earnings"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Réserves / bénéfices reportés</FormLabel>
                  <FormControl>
                    <NumField value={field.value ?? ""} onChange={field.onChange} suffix="CHF" />
                  </FormControl>
                  <FormDescription>
                    Cumul disponible au bilan, utile pour les comparatifs dividende / salaire.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* Notes */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes internes</FormLabel>
                <FormControl>
                  <Textarea rows={4} placeholder="Contexte, particularités…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              mode === "edit" && initial
                ? navigate({ to: "/companies/$companyId", params: { companyId: initial.id } })
                : navigate({ to: "/companies" })
            }
          >
            Annuler
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "create" ? "Créer la société" : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
