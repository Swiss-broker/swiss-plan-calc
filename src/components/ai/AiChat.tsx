import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, Send, Loader2, ChevronDown, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SYSTEM_PROMPT = `Tu es l'assistant IA de SwissBroker Pro, une plateforme SaaS pour courtiers en assurances suisses spécialisés en prévoyance et fiscalité.

Tu aides les courtiers suisses à :
- Comprendre les calculs fiscaux suisses (IFD, ICC, impôt à la source, frontaliers)
- Optimiser la prévoyance de leurs clients (LPP, 3a, 3b, rachats)
- Interpréter les résultats des calculateurs de l'application
- Naviguer dans les règles fiscales complexes (accord 1983, IS Genève, TOU)

Règles importantes :
- Tu réponds dans la langue de l'utilisateur : français, allemand, italien ou anglais. Par défaut tu réponds en français
- Tu es précis et professionnel, mais accessible
- Tu cites toujours la source (OFAS, AFC, loi LPP, etc.)
- Tu ne donnes jamais de conseil juridique ou fiscal définitif
- Paramètres 2026 : plafond 3a 7 258 CHF, déduction coordination LPP 26 460 CHF, taux minimal LPP 1.25%, taux conversion retenu 6.0%
- Frontaliers : accord 1983 (VD, VS, NE, JU) = 4.5% ; Genève = IS genevoise ; Fribourg = IS cantonale
- Tu es concis : réponses courtes et structurées. INTERDIT : emojis, asterisques (**), dièses (#), markdown de toute sorte. Texte brut uniquement, tirets simples pour les listes.`;

export function AiChat() {
const { activeClient, setActiveClient, activeBundle } = useActiveClient();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get("clientId");
    if (clientId && !activeClient) {
      supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single()
        .then(({ data }) => {
          if (data) setActiveClient(data);
        });
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (open && !minimized) scrollToBottom();
  }, [messages, open, minimized, scrollToBottom]);

  useEffect(() => {
    if (open && !minimized && messages.length === 0) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "Bonjour ! Je suis votre assistant SwissBroker Pro. Je peux vous aider avec les calculs fiscaux, la prévoyance LPP, les frontaliers et l'interprétation des résultats. Quelle est votre question ?",
        timestamp: new Date(),
      }]);
    }
  }, [open, minimized, messages.length]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const p = activeBundle?.pension;
      const a = activeBundle?.assets;
      const clientContext = activeClient ? `

CONTEXTE CLIENT ACTIF — ${activeClient.first_name} ${activeClient.last_name} :

IDENTITÉ
- Âge : ${activeClient.date_of_birth ? new Date().getFullYear() - new Date(activeClient.date_of_birth).getFullYear() + " ans" : "non renseigné"}
- Canton : ${activeClient.canton ?? "non renseigné"}
- Statut fiscal : ${activeClient.tax_status ?? "non renseigné"}
- Situation civile : ${activeClient.civil_status ?? "non renseigné"}
- Permis : ${activeClient.permit ?? "non renseigné"}
- Enfants : ${Array.isArray(activeClient.children) ? activeClient.children.length : 0}

REVENUS
- Salaire brut annuel : ${activeClient.gross_annual_salary ? Number(activeClient.gross_annual_salary).toLocaleString("fr-CH") + " CHF" : "non renseigné"}
- Bonus / 13e : ${activeClient.bonus ? Number(activeClient.bonus).toLocaleString("fr-CH") + " CHF" : "0 CHF"}
- Autres revenus : ${activeClient.other_income ? Number(activeClient.other_income).toLocaleString("fr-CH") + " CHF" : "0 CHF"}
- Salaire conjoint : ${activeClient.spouse_gross_annual_salary ? Number(activeClient.spouse_gross_annual_salary).toLocaleString("fr-CH") + " CHF" : "non renseigné"}
- Employeur : ${activeClient.employer ?? "non renseigné"}

PRÉVOYANCE
- Avoir LPP actuel : ${p ? Number(p.lpp_current_balance).toLocaleString("fr-CH") + " CHF" : "non renseigné"}
- Salaire assuré LPP : ${p ? Number(p.lpp_insured_salary).toLocaleString("fr-CH") + " CHF" : "non renseigné"}
- Capacité de rachat LPP : ${p ? Number(p.lpp_max_buyback).toLocaleString("fr-CH") + " CHF" : "non renseigné"}
- Versement 3a annuel : ${p ? Number(p.pillar_3a_annual_contribution).toLocaleString("fr-CH") + " CHF" : "non renseigné"}
- LPP conjoint : ${p ? Number(p.spouse_lpp_balance).toLocaleString("fr-CH") + " CHF" : "non renseigné"}
- 3a conjoint : ${p ? Number(p.spouse_pillar_3a_balance).toLocaleString("fr-CH") + " CHF" : "non renseigné"}

PATRIMOINE
- Comptes bancaires : ${a ? Number(a.bank_accounts).toLocaleString("fr-CH") + " CHF" : "non renseigné"}
- Titres / portefeuille : ${a ? Number(a.securities).toLocaleString("fr-CH") + " CHF" : "non renseigné"}
- Immobilier (valeur) : ${a ? Number(a.real_estate_value).toLocaleString("fr-CH") + " CHF" : "non renseigné"}
- Dette hypothécaire : ${a ? Number(a.mortgage_debt).toLocaleString("fr-CH") + " CHF" : "non renseigné"}` : "";
      const history = [...messages, userMessage]
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch(
        "https://ihepboeaudnxqxijeykl.supabase.co/functions/v1/ai-chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            system: SYSTEM_PROMPT + clientContext,
            messages: history,
          }),
        }
      );;

      const data = await response.json();
      const assistantContent = data.content?.[0]?.text ?? "Désolé, je n'ai pas pu générer une réponse.";

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: assistantContent,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Une erreur est survenue. Vérifiez votre connexion et réessayez.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-elegant transition-all hover:scale-110 hover:shadow-xl active:scale-95"
          aria-label="Ouvrir l'assistant IA"
        >
          <Sparkles className="h-6 w-6 text-primary-foreground" />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-success text-[9px] font-bold text-white">
            IA
          </span>
        </button>
      )}

      {open && (
        <div
          className={`fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-elegant transition-all duration-300
            ${minimized ? "bottom-6 right-6 h-14 w-72" : "bottom-6 right-6 h-[560px] w-[380px] max-h-[calc(100vh-6rem)] max-w-[calc(100vw-2rem)]"}`}
          style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
        >
          <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-primary to-primary/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Assistant SwissBroker</div>
                {!minimized && (
                  <div className="flex items-center gap-1 text-[10px] text-white/70">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    En ligne · Powered by Claude
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinimized((v) => !v)}
                className="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${minimized ? "rotate-180" : ""}`} />
              </button>
              <button
                onClick={() => { setOpen(false); setMinimized(false); }}
                className="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold
                      ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                    </div>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed
                      ${msg.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted/60 text-foreground"}`}>
                      <ReactMarkdown
  components={{
    p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
    strong: ({ children }) => <span className="font-semibold">{children}</span>,
    ul: ({ children }) => <ul className="ml-3 list-disc space-y-0.5">{children}</ul>,
    ol: ({ children }) => <ol className="ml-3 list-decimal space-y-0.5">{children}</ol>,
    li: ({ children }) => <li className="text-sm">{children}</li>,
    h1: ({ children }) => <p className="font-semibold">{children}</p>,
    h2: ({ children }) => <p className="font-semibold">{children}</p>,
    h3: ({ children }) => <p className="font-semibold">{children}</p>,
  }}
>
  {msg.content}
</ReactMarkdown>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted/60 px-3 py-2">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-border p-3">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Posez votre question…"
                    className="min-h-[40px] max-h-[120px] resize-none text-sm"
                    rows={1}
                    disabled={loading}
                  />
                  <Button
                    size="icon"
                    onClick={sendMessage}
                    disabled={!input.trim() || loading}
                    className="h-10 w-10 shrink-0 rounded-xl shadow-elegant"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                  Entrée pour envoyer · Maj+Entrée pour nouvelle ligne
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
