// supabase/functions/wiki-generate-article/index.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// Repli si Anthropic retire le modele principal (deja arrive une fois :
// claude-sonnet-4-5-20250929 retire, panne totale sans aucun repli — voir
// ai-chat/index.ts qui a le meme mecanisme pour le chat/"Preparer le RDV").
// Uniquement applique a l'appel de traduction (texte simple, sans outil) :
// l'appel de recherche utilise le tool web_search, dont le comportement
// avec un autre modele n'est pas verifiable depuis ici, donc pas de repli
// automatique la-dessus pour ne pas remplacer une erreur claire par un
// echec silencieux different.
const FALLBACK_MODEL = "claude-haiku-4-5-20251001";
function isModelUnavailable(status: number, data: { error?: { type?: string } }): boolean {
  return status === 404 && data?.error?.type === "not_found_error";
}

// Sources officielles suisses autorisées pour la recherche (jamais d'autres domaines)
const ALLOWED_DOMAINS = [
  "estv.admin.ch",
  "bsv.admin.ch",
  "priminfo.admin.ch",
  "admin.ch",
  "ge.ch",
  "vd.ch",
  "vs.ch",
  "fr.ch",
  "ne.ch",
  "ju.ch",
  "zg.ch",
  "sz.ch",
  "be.ch",
];

function extractFinalText(content: any[]): string {
  // Le dernier bloc de type "text" contient la réponse finale (après recherche web)
  const textBlocks = content.filter((b: any) => b.type === "text");
  return textBlocks.length ? textBlocks[textBlocks.length - 1].text : "";
}

function parseJsonResponse(raw: string): any {
  // Extrait uniquement le bloc JSON, même si Claude a ajouté du texte avant/après malgré la consigne
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error(`Aucun JSON trouvé dans la réponse : ${cleaned.slice(0, 200)}`);
  }
  const jsonOnly = cleaned.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonOnly);
}
function stripCitationTags(text: string): string {
  // Retire les balises <cite index="...">... ajoutées par Claude lors de la recherche web,
  // en gardant uniquement le texte qu'elles contiennent
  return text.replace(/<cite[^>]*>(.*?)<\/cite>/gs, "$1");
}

/** Extrait l'id utilisateur vérifié depuis le JWT de la requête (déjà
 *  validé par la plateforme Supabase — verify_jwt=true dans config.toml —
 *  avant même l'exécution de cette fonction). Ne JAMAIS faire confiance à
 *  un id envoyé dans le corps de la requête pour l'identité de l'appelant :
 *  n'importe qui pourrait sinon usurper n'importe quel autre compte. */
function getVerifiedUserId(req: Request): string {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Non authentifié.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Jeton invalide.");
  let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  const payload = JSON.parse(atob(b64));
  if (!payload.sub) throw new Error("Jeton invalide.");
  return payload.sub as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const callerId = getVerifiedUserId(req);
    const { topic } = await req.json();
    if (!topic || typeof topic !== "string") {
      throw new Error("Le sujet de l'article est requis.");
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!apiKey || !supabaseUrl || !supabaseKey) {
      throw new Error("Variables d'environnement manquantes");
    }

    // Génération de contenu coûteuse (recherche web + traduction via
    // l'API Anthropic) réservée aux administrateurs : ni un courtier
    // normal, ni personne d'anonyme, ne doit pouvoir la déclencher.
    const adminRes = await fetch(
      `${supabaseUrl}/rest/v1/admin_users?user_id=eq.${callerId}&select=user_id`,
      { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } },
    );
    const adminRows = await adminRes.json();
    if (!Array.isArray(adminRows) || adminRows.length === 0) {
      throw new Error("Réservé aux administrateurs.");
    }

    // ── 1. Génération FR avec recherche sur sources officielles ──
    const researchPrompt = `Tu es un rédacteur spécialisé en fiscalité et prévoyance suisse, pour un wiki destiné à des courtiers en assurance/prévoyance professionnels en Suisse romande.

Sujet de l'article : "${topic}"

Recherche les informations exactes et à jour sur les sources officielles suisses (AFC/estv.admin.ch, OFAS/bsv.admin.ch, priminfo.admin.ch, sites cantonaux officiels). N'invente JAMAIS un chiffre, un taux ou une règle : si une information n'est pas trouvée avec certitude, ne l'inclus pas.

Une fois ta recherche terminée, réponds UNIQUEMENT avec un objet JSON (aucun texte avant ou après, pas de balises markdown), au format exact suivant :
{
  "title": "titre court et clair de l'article",
  "category": "catégorie parmi : Prise en main / 1er pilier · AVS / AI / 2e pilier · LPP & rachats / 3e pilier · A & B / Frontaliers & impôt source / Fiscalité / Dirigeant de société / Synthèse & rendez-vous",
  "tags": ["3-6 mots-clés courts"],
  "body_markdown": "contenu de l'article en markdown, format liste à puces avec ** pour le gras, style concis et factuel comme les autres articles du wiki, 4 à 8 points maximum",
  "sources": [{"title": "nom de la source", "url": "url exacte consultée"}]
}`;

    const researchRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4000,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 5,
            allowed_domains: ALLOWED_DOMAINS,
          },
        ],
        messages: [{ role: "user", content: researchPrompt }],
      }),
    });

    const researchData = await researchRes.json();
    if (!researchRes.ok) {
      console.error("Erreur Anthropic (recherche):", researchRes.status, JSON.stringify(researchData));
      throw new Error(`Erreur Anthropic (recherche) : ${JSON.stringify(researchData)}`);
    }

    const frRaw = extractFinalText(researchData.content);
    const frArticle = parseJsonResponse(frRaw);
frArticle.body_markdown = stripCitationTags(frArticle.body_markdown);

    // ── 2. Traduction DE/EN/IT à partir du FR déjà validé (pas de nouvelle recherche) ──
    const translatePrompt = `Traduis cet article fiscal/prévoyance suisse depuis le français vers l'allemand, l'anglais et l'italien. Traduis fidèlement le sens et les chiffres, sans ajouter ni inventer d'information nouvelle.

Titre FR : ${frArticle.title}
Contenu FR (markdown) :
${frArticle.body_markdown}

Réponds UNIQUEMENT avec un objet JSON (aucun texte avant/après, pas de balises markdown) au format exact :
{
  "de": {"title": "...", "body_markdown": "..."},
  "en": {"title": "...", "body_markdown": "..."},
  "it": {"title": "...", "body_markdown": "..."}
}`;

    async function callTranslate(model: string) {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4000,
          messages: [{ role: "user", content: translatePrompt }],
        }),
      });
      return { res, data: await res.json() };
    }

    let { res: translateRes, data: translateData } = await callTranslate("claude-sonnet-5");
    if (!translateRes.ok && isModelUnavailable(translateRes.status, translateData)) {
      ({ res: translateRes, data: translateData } = await callTranslate(FALLBACK_MODEL));
    }
    if (!translateRes.ok) {
      console.error("Erreur Anthropic (traduction):", translateRes.status, JSON.stringify(translateData));
      throw new Error(`Erreur Anthropic (traduction) : ${JSON.stringify(translateData)}`);
    }

    const translations = parseJsonResponse(extractFinalText(translateData.content));

    // ── 3. Insertion en base, statut "draft" ──
    const slug = topic
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // retire les accents
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

    const articleRes = await fetch(`${supabaseUrl}/rest/v1/wiki_articles`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        slug: `${slug}-${Date.now().toString(36)}`, // suffixe pour garantir l'unicité
        category: frArticle.category,
        tags: frArticle.tags,
        status: "draft",
        sources: frArticle.sources ?? [],
      }),
    });
    const [insertedArticle] = await articleRes.json();
    if (!articleRes.ok || !insertedArticle) {
      throw new Error("Erreur insertion article");
    }

    const translationsToInsert = [
      { article_id: insertedArticle.id, language: "fr", title: frArticle.title, body_markdown: frArticle.body_markdown },
      { article_id: insertedArticle.id, language: "de", title: translations.de.title, body_markdown: translations.de.body_markdown },
      { article_id: insertedArticle.id, language: "en", title: translations.en.title, body_markdown: translations.en.body_markdown },
      { article_id: insertedArticle.id, language: "it", title: translations.it.title, body_markdown: translations.it.body_markdown },
    ];

    await fetch(`${supabaseUrl}/rest/v1/wiki_article_translations`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(translationsToInsert),
    });

    return new Response(JSON.stringify({ success: true, articleId: insertedArticle.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});