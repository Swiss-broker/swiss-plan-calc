import { useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import type { Client, ClientPension, ClientAssets } from "@/lib/clients/types";

interface Props {
  client: Client;
  pension: ClientPension | null;
  assets: ClientAssets | null;
}

export function AiAnalysis({ client, pension, assets }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const buildPrompt = () => {
    const p = pension;
    const a = assets;
    return `Tu es un expert en prévoyance et fiscalité suisse. Analyse la situation de ce client et donne un briefing structuré pour préparer le rendez-vous courtier.

CLIENT : ${client.first_name} ${client.last_name}
- Canton : ${client.canton ?? "non renseigné"}
- Statut fiscal : ${client.tax_status ?? "non renseigné"}
- Situation civile : ${client.civil_status ?? "non renseigné"}
- Permis : ${client.permit ?? "non renseigné"}
- Âge : ${client.date_of_birth ? new Date().getFullYear() - new Date(client.date_of_birth).getFullYear() : "non renseigné"} ans

REVENUS
- Salaire brut : ${client.gross_annual_salary ? Number(client.gross_annual_salary).toLocaleString("fr-CH") + " CHF" : "non renseigné"}
- Bonus : ${client.bonus ? Number(client.bonus).toLocaleString("fr-CH") + " CHF" : "0"}
- Salaire conjoint : ${client.spouse_gross_annual_salary ? Number(client.spouse_gross_annual_salary).toLocaleString("fr-CH") + " CHF" : "non renseigné"}

PRÉVOYANCE
- Avoir LPP : ${p ? Number(p.lpp_current_balance).toLocaleString("fr-CH") + " CHF" : "non renseigné"}
- Capacité de rachat LPP : ${p ? Number(p.lpp_max_buyback).toLocaleString("fr-CH") + " CHF" : "non renseigné"}
- Versement 3a annuel : ${p ? Number(p.pillar_3a_annual_contribution).toLocaleString("fr-CH") + " CHF" : "non renseigné"}

PATRIMOINE
- Fortune nette : ${a ? (Number(a.bank_accounts ?? 0) + Number(a.securities ?? 0) + Number(a.real_estate_value ?? 0) - Number(a.mortgage_debt ?? 0)).toLocaleString("fr-CH") + " CHF" : "non renseigné"}

Génère un briefing structuré en 3 sections :
1. PRIORITÉS DU RDV (3 actions max, chiffrées si possible)
2. CALCULATEURS À LANCER (dans l'ordre de priorité)
3. POINTS DE VIGILANCE (alertes spécifiques à ce profil)

Sois concis, actionnable, sans emojis ni astérisques. Texte brut uniquement, tirets simples pour les listes.`;
  };

  const launch = async () => {
    setLoading(true);
    setAnalysis(null);
    try {
      const response = await fetch(
        "https://ihepboeaudnxqxijeykl.supabase.co/functions/v1/ai-chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            system: "Tu es un expert en prévoyance et fiscalité suisse. Tu réponds en français, sans emojis, sans astérisques, en texte brut structuré.",
            messages: [{ role: "user", content: buildPrompt() }],
          }),
        }
      );
      const data = await response.json();
      setAnalysis(data.content?.[0]?.text ?? "Impossible de générer l'analyse.");
      setOpen(true);
    } catch {
      setAnalysis("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-semibold">Préparer le RDV avec {client.first_name}</div>
            <div className="text-xs text-muted-foreground">Analyse IA de la situation · ~10 secondes</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {analysis && (
            <button onClick={() => setOpen(v => !v)} className="text-muted-foreground hover:text-foreground">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          <Button size="sm" onClick={launch} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Analyse en cours..." : analysis ? "Relancer" : "Lancer l'analyse"}
          </Button>
        </div>
      </div>

      {analysis && open && (
        <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm leading-relaxed">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <span className="font-semibold">{children}</span>,
              ul: ({ children }) => <ul className="ml-3 list-disc space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="ml-3 list-decimal space-y-1">{children}</ol>,
              li: ({ children }) => <li>{children}</li>,
              h1: ({ children }) => <p className="mt-3 font-semibold text-primary first:mt-0">{children}</p>,
              h2: ({ children }) => <p className="mt-3 font-semibold text-primary first:mt-0">{children}</p>,
              h3: ({ children }) => <p className="mt-3 font-semibold text-primary first:mt-0">{children}</p>,
            }}
          >
            {analysis}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

interface CompanyProps {
  company: import("@/lib/companies/types").Company;
  directors: import("@/lib/clients/types").Client[];
}

export function AiAnalysisCompany({ company, directors }: CompanyProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const buildPrompt = () => {
    const dir = directors[0];
    return `Tu es un expert en fiscalité des sociétés suisses. Analyse cette société et génère un briefing pour le courtier.

SOCIÉTÉ : ${company.legal_name}
- Forme juridique : ${company.legal_form}
- Canton siège : ${company.canton ?? "non renseigné"}
- Fondée en : ${company.founded_year ?? "non renseigné"}
- Bénéfice annuel : ${company.annual_profit ? Number(company.annual_profit).toLocaleString("fr-CH") + " CHF" : "non renseigné"}
- Bénéfices en réserve : ${company.retained_earnings ? Number(company.retained_earnings).toLocaleString("fr-CH") + " CHF" : "0 CHF"}
- Chiffre d'affaires : ${company.annual_revenue ? Number(company.annual_revenue).toLocaleString("fr-CH") + " CHF" : "non renseigné"}

DIRIGEANT RATTACHÉ : ${dir ? `${dir.first_name} ${dir.last_name}, ${dir.civil_status ?? ""}, canton ${dir.canton ?? ""}, salaire actuel ${dir.gross_annual_salary ? Number(dir.gross_annual_salary).toLocaleString("fr-CH") + " CHF" : "non renseigné"}` : "Aucun dirigeant rattaché"}

Génère un briefing structuré en 3 sections :
1. STRATÉGIE DE RÉMUNÉRATION (salaire vs dividendes, optimisation IS + IR)
2. POINTS D'ATTENTION (réserves, impôt anticipé, dividende dissimulé, LPP dirigeant)
3. ACTIONS PRIORITAIRES (ce que le courtier doit vérifier ou proposer)

Sois concis, chiffré si possible, sans emojis ni astérisques. Texte brut uniquement.`;
  };

  const launch = async () => {
    setLoading(true);
    setAnalysis(null);
    try {
      const response = await fetch(
        "https://ihepboeaudnxqxijeykl.supabase.co/functions/v1/ai-chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            system: "Tu es un expert en fiscalité des sociétés suisses. Tu réponds en français, sans emojis, sans astérisques, en texte brut structuré.",
            messages: [{ role: "user", content: buildPrompt() }],
          }),
        }
      );
      const data = await response.json();
      setAnalysis(data.content?.[0]?.text ?? "Impossible de générer l'analyse.");
      setOpen(true);
    } catch {
      setAnalysis("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-semibold">Analyser {company.legal_name}</div>
            <div className="text-xs text-muted-foreground">Analyse IA de la société · ~10 secondes</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {analysis && (
            <button onClick={() => setOpen(v => !v)} className="text-muted-foreground hover:text-foreground">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          <Button size="sm" onClick={launch} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Analyse en cours..." : analysis ? "Relancer" : "Lancer l'analyse"}
          </Button>
        </div>
      </div>
      {analysis && open && (
        <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm leading-relaxed">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <span className="font-semibold">{children}</span>,
              ul: ({ children }) => <ul className="ml-3 list-disc space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="ml-3 list-decimal space-y-1">{children}</ol>,
              li: ({ children }) => <li>{children}</li>,
              h1: ({ children }) => <p className="mt-3 font-semibold text-primary first:mt-0">{children}</p>,
              h2: ({ children }) => <p className="mt-3 font-semibold text-primary first:mt-0">{children}</p>,
              h3: ({ children }) => <p className="mt-3 font-semibold text-primary first:mt-0">{children}</p>,
            }}
          >
            {analysis}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
