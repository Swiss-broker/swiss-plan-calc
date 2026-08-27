// supabase/functions/client-upload/index.ts
// Endpoint public (verify_jwt=false) permettant a un client final NON
// authentifie de deposer des documents via le lien a token genere par son
// courtier (voir src/components/clients/DocumentsTab.tsx). Remplace
// l'ancienne route TanStack Start src/routes/api/public/client-upload.$token.ts,
// qui n'a jamais pu s'executer en production : ce projet est une SPA Vite
// statique deployee sur Vercel, pas une application TanStack Start avec
// runtime serveur (@tanstack/react-start n'est meme pas une dependance).
//
// Toute l'identite (client_id / broker_id) est TOUJOURS derivee du token
// cote serveur, jamais d'un champ envoye par l'appelant : il n'existe pas
// de parametre "clientId" dans le contrat de cette fonction. La validation
// finale (expiration / revocation / quota) est re-verifiee de facon atomique
// par register_client_upload (SELECT ... FOR UPDATE) : les checks faits ici
// avant l'upload ne sont qu'un fail-fast, pas la garde-fou definitive.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const ALLOWED_CATEGORIES = new Set([
  "attestation_lpp",
  "libre_passage",
  "fiche_salaire",
  "declaration_fiscale",
  "piece_identite",
  "police_3e_pilier",
  "police_lca",
  "certificat_avs",
  "documents_bancaires",
  "autres",
]);

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.slice(0, 120) || "fichier";
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorCodeFromMessage(message: string | undefined, fallback: string): string {
  return (message || "").match(/LINK_[A-Z_]+/)?.[0] || fallback;
}

// Rate-limit "best effort" par isolate : les Edge Functions sont recyclees
// regulierement, ceci ralentit l'abus sans etre une garantie absolue. La
// vraie protection contre le depassement de quota est atomique en base
// (register_client_upload), pas ce compteur en memoire.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(token: string, now = Date.now()): boolean {
  const entry = rateMap.get(token);
  if (!entry || entry.resetAt < now) {
    rateMap.set(token, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

// Exposee uniquement pour les tests : evite qu'un test pollue le suivant.
export function _resetRateLimitForTests() {
  rateMap.clear();
}

export type Env = { supabaseUrl: string; supabaseKey: string };

export async function handleClientUploadRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { supabaseUrl, supabaseKey } = env;
  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse({ error: "CONFIG_MISSING" }, 500);
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    // ---- Consultation des infos du lien ----
    // (POST + JSON, pour rester coherent avec le reste des Edge Functions
    // de ce projet, qui n'utilisent pas de sous-routes GET par path param)
    if (!contentType.includes("multipart/form-data")) {
      const body = await req.json().catch(() => ({}));
      const token = typeof body?.token === "string" ? body.token : "";
      if (!token || token.length < 16) return jsonResponse({ error: "INVALID_TOKEN" }, 400);

      const infoRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_upload_link_info`, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ _token: token }),
      });
      const infoBody = await infoRes.json();
      if (!infoRes.ok) {
        const code = errorCodeFromMessage(infoBody?.message, "LINK_NOT_FOUND");
        return jsonResponse({ error: code }, 404);
      }
      const row = Array.isArray(infoBody) ? infoBody[0] : infoBody;
      if (!row) return jsonResponse({ error: "LINK_NOT_FOUND" }, 404);

      return jsonResponse({
        clientFirstName: row.client_first_name,
        brokerDisplay: row.broker_display,
        expiresAt: row.expires_at,
        uploadsRemaining: row.uploads_remaining,
      });
    }

    // ---- Depot d'un fichier ----
    const form = await req.formData().catch(() => null);
    if (!form) return jsonResponse({ error: "INVALID_BODY" }, 400);

    const token = String(form.get("token") || "");
    const category = String(form.get("category") || "");
    const file = form.get("file");

    if (!token || token.length < 16) return jsonResponse({ error: "INVALID_TOKEN" }, 400);
    if (!rateLimit(token)) return jsonResponse({ error: "RATE_LIMITED" }, 429);
    if (!(file instanceof File)) return jsonResponse({ error: "FILE_REQUIRED" }, 400);
    if (!ALLOWED_CATEGORIES.has(category)) return jsonResponse({ error: "INVALID_CATEGORY" }, 400);
    if (!ALLOWED_MIME_TYPES.has(file.type)) return jsonResponse({ error: "INVALID_TYPE" }, 400);
    if (file.size <= 0) return jsonResponse({ error: "EMPTY_FILE" }, 400);
    if (file.size > MAX_FILE_SIZE_BYTES) return jsonResponse({ error: "FILE_TOO_LARGE" }, 400);

    // Le broker_id / client_id ne sont jamais lus depuis la requete : ils
    // viennent exclusivement de la ligne resolue par le token. Un champ
    // "clientId" envoye dans le formulaire (legitime ou non) est purement
    // et simplement ignore : il n'est jamais lu ci-dessus ni ci-dessous.
    const linkRes = await fetch(
      `${supabaseUrl}/rest/v1/client_document_links?token=eq.${encodeURIComponent(token)}&select=id,client_id,broker_id,revoked,expires_at,max_uploads,upload_count`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    );
    const linkRows = await linkRes.json();
    const link = Array.isArray(linkRows) ? linkRows[0] : null;
    if (!link) return jsonResponse({ error: "LINK_NOT_FOUND" }, 404);
    if (link.revoked) return jsonResponse({ error: "LINK_REVOKED" }, 403);
    if (new Date(link.expires_at) < new Date()) return jsonResponse({ error: "LINK_EXPIRED" }, 403);
    if (link.upload_count >= link.max_uploads) {
      return jsonResponse({ error: "LINK_QUOTA_REACHED" }, 403);
    }

    const safeName = sanitizeFilename(file.name);
    const storagePath = `${link.broker_id}/${link.client_id}/${category}/${crypto.randomUUID()}_${safeName}`;

    const buffer = await file.arrayBuffer();
    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/client-documents/${storagePath}`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": file.type,
      },
      body: buffer,
    });
    if (!uploadRes.ok) {
      const detail = await uploadRes.text();
      return jsonResponse({ error: "UPLOAD_FAILED", detail }, 500);
    }

    // register_client_upload revalide tout (expiration/quota/revocation)
    // de facon atomique (SELECT ... FOR UPDATE) avant d'inserer le
    // document et d'incrementer le quota : c'est la garde-fou definitive,
    // les checks ci-dessus ne sont qu'un fail-fast pour eviter un upload
    // storage inutile quand c'est deja clairement invalide.
    const registerRes = await fetch(`${supabaseUrl}/rest/v1/rpc/register_client_upload`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        _token: token,
        _category: category,
        _original_filename: safeName,
        _storage_path: storagePath,
        _mime_type: file.type,
        _size_bytes: file.size,
      }),
    });
    const registerBody = await registerRes.json();
    if (!registerRes.ok) {
      // Rollback du fichier deja stocke si l'enregistrement en base echoue
      // (ex: quota atteint entre-temps par un upload concurrent).
      await fetch(`${supabaseUrl}/storage/v1/object/client-documents/${storagePath}`, {
        method: "DELETE",
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      });
      const code = errorCodeFromMessage(registerBody?.message, "REGISTER_FAILED");
      return jsonResponse({ error: code }, 403);
    }

    return jsonResponse({ documentId: registerBody, filename: safeName });
  } catch (err) {
    return jsonResponse({ error: "UNEXPECTED", detail: String(err) }, 500);
  }
}

// `Deno` n'existe pas sous Node/Vitest : ce garde-fou permet d'importer ce
// fichier depuis les tests (handleClientUploadRequest) sans jamais tenter
// de demarrer un vrai serveur Deno en dehors du runtime Edge Functions.
declare const Deno: { serve: (h: (req: Request) => Response | Promise<Response>) => void; env: { get(k: string): string | undefined } } | undefined;
if (typeof Deno !== "undefined") {
  Deno.serve((req) =>
    handleClientUploadRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    }),
  );
}
