import "@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// Modele principal, puis repli si Anthropic le retire (ancien modele
// deja rencontre : claude-sonnet-4-5-20250929 retire en cours de route,
// panne totale du chat ET de "Preparer le RDV" qui partagent cette
// fonction, sans aucun repli). Le repli est un modele different (pas
// juste une version plus vieille du meme), pour ne pas tomber sur le
// meme risque de retrait au meme moment.
const PRIMARY_MODEL = "claude-sonnet-5";
const FALLBACK_MODEL = "claude-haiku-4-5-20251001";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callAnthropic(apiKey: string, model: string, system: unknown, messages: unknown) {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    // Le "thinking" etendu est desactive explicitement : sur un prompt
    // structure (briefing client, chat), le modele pouvait consommer tout
    // le budget max_tokens en reflexion interne et repondre avec un bloc
    // "thinking" mais AUCUN bloc "text" -- ecran vide cote courtier, sans
    // la moindre erreur remontee (statut 200). Ces prompts n'ont pas besoin
    // de raisonnement etendu, une reponse directe suffit.
    body: JSON.stringify({ model, max_tokens: 1024, system, messages, thinking: { type: "disabled" } }),
  });
  const data = await response.json();
  return { response, data };
}

// Un modele retire/inconnu cote Anthropic renvoie un statut 404 avec
// error.type "not_found_error" : c'est le seul cas ou retenter avec un
// autre modele a du sens (une vraie erreur de requete echouerait pareil
// avec n'importe quel modele).
function isModelUnavailable(status: number, data: { error?: { type?: string } }): boolean {
  return status === 404 && data.error?.type === "not_found_error";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages, system } = await req.json();
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY manquante dans les secrets Supabase");
      return new Response(JSON.stringify({ error: "Cle API manquante cote serveur" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let { response, data } = await callAnthropic(apiKey, PRIMARY_MODEL, system, messages);

    if (!response.ok && isModelUnavailable(response.status, data)) {
      console.error(`Modele ${PRIMARY_MODEL} indisponible, repli sur ${FALLBACK_MODEL}`);
      ({ response, data } = await callAnthropic(apiKey, FALLBACK_MODEL, system, messages));
    }

    // On journalise systematiquement la reponse quand Anthropic renvoie une erreur,
    // au lieu de laisser passer silencieusement un statut non-200 comme avant.
    if (!response.ok) {
      console.error("Erreur API Anthropic:", response.status, JSON.stringify(data));
      return new Response(JSON.stringify({ error: data.error?.message || "Erreur API Anthropic", details: data }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Exception dans ai-chat:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});