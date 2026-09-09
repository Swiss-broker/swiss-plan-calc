// supabase/functions/complete-onboarding/index.ts
// Endpoint public (verify_jwt=false) : consomme un token client_invites
// pour créer le compte du courtier (auth + profil), à l'issue du paiement
// commercial (generate-offer -> handle-conversion -> cet écran).
//
// Point important sur profiles : un trigger existant (handle_new_user, sur
// auth.users AFTER INSERT) crée déjà automatiquement la ligne profiles dès
// que l'utilisateur Auth est créé (avec plan='trial' par défaut, et
// first_name/last_name lus depuis raw_user_meta_data). On ne fait donc
// JAMAIS d'INSERT profiles ici — ce serait une violation de clé primaire —
// seulement un PATCH après coup pour appliquer le vrai plan (celui de
// l'invitation) et les champs que le trigger ne connaît pas.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ALLOWED_PLANS = new Set(["starter", "pro", "cabinet"]);

export type Env = { supabaseUrl: string; supabaseKey: string };

export async function handleCompleteOnboardingRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { supabaseUrl, supabaseKey } = env;
  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse({ error: "CONFIG_MISSING" }, 500);
  }

  const svcHeaders = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  };

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const firstName = typeof body?.first_name === "string" ? body.first_name.trim() : "";
    const lastName = typeof body?.last_name === "string" ? body.last_name.trim() : "";
    const brokerageName = typeof body?.brokerage_name === "string" ? body.brokerage_name.trim() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

    if (!token || token.length < 16) return jsonResponse({ error: "INVITE_NOT_FOUND" }, 404);
    if (password.length < 8) return jsonResponse({ error: "PASSWORD_TOO_SHORT" }, 400);
    if (!firstName || !lastName) return jsonResponse({ error: "NAME_REQUIRED" }, 400);

    // Réclamation atomique du token : un seul PATCH conditionné sur
    // used_at IS NULL / revoked=false / expires_at > now, exactement comme
    // register_client_upload le fait pour client_document_links. Postgres
    // garantit qu'une seule requête concurrente peut matcher la ligne et la
    // faire passer à used_at NOT NULL — pas besoin de FOR UPDATE explicite
    // pour cet invariant à une seule colonne.
    const nowIso = new Date().toISOString();
    const claimRes = await fetch(
      `${supabaseUrl}/rest/v1/client_invites?token=eq.${encodeURIComponent(token)}&used_at=is.null&revoked=eq.false&expires_at=gt.${encodeURIComponent(nowIso)}`,
      {
        method: "PATCH",
        headers: { ...svcHeaders, Prefer: "return=representation" },
        body: JSON.stringify({ used_at: nowIso }),
      },
    );
    const claimedRows = await claimRes.json();
    const invite = Array.isArray(claimedRows) ? claimedRows[0] : null;

    if (!invite) {
      // La réclamation a échoué : on relit l'invitation (sans condition)
      // pour dire précisément pourquoi, au lieu d'un message générique.
      const lookupRes = await fetch(
        `${supabaseUrl}/rest/v1/client_invites?token=eq.${encodeURIComponent(token)}&select=revoked,expires_at,used_at`,
        { headers: svcHeaders },
      );
      const lookupRows = await lookupRes.json();
      const existing = Array.isArray(lookupRows) ? lookupRows[0] : null;
      if (!existing) return jsonResponse({ error: "INVITE_NOT_FOUND" }, 404);
      if (existing.revoked) return jsonResponse({ error: "INVITE_REVOKED" }, 403);
      if (existing.used_at) return jsonResponse({ error: "INVITE_USED" }, 403);
      return jsonResponse({ error: "INVITE_EXPIRED" }, 403);
    }

    const plan = ALLOWED_PLANS.has(invite.plan) ? invite.plan : "starter";

    // Création du compte Auth. email_confirm=true : ce courtier a déjà
    // prouvé la possession de cette adresse en cliquant le lien reçu par
    // email après paiement — pas besoin d'un second aller-retour de
    // confirmation qui n'ajouterait aucune garantie supplémentaire ici.
    const createUserRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: svcHeaders,
      body: JSON.stringify({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName },
      }),
    });
    const createUserBody = await createUserRes.json();
    if (!createUserRes.ok) {
      // Échec : on relâche la réclamation pour que le lien reste utilisable
      // (ex. mot de passe refusé par une règle Supabase, panne transitoire).
      await releaseInviteClaim(supabaseUrl, svcHeaders, token);
      const code = createUserBody?.error_code === "email_exists" ? "EMAIL_ALREADY_REGISTERED" : "ACCOUNT_CREATE_FAILED";
      return jsonResponse({ error: code, detail: createUserBody?.msg ?? createUserBody?.message }, 400);
    }
    const newUserId = createUserBody.id ?? createUserBody.user?.id;

    // Le trigger handle_new_user a déjà créé la ligne profiles à ce stade
    // (plan='trial', first_name/last_name depuis user_metadata). On
    // applique ici le vrai plan de l'invitation et les champs restants.
    const patchProfileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${newUserId}`, {
      method: "PATCH",
      headers: { ...svcHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        plan,
        brokerage_name: brokerageName || null,
        phone: phone || null,
      }),
    });
    if (!patchProfileRes.ok) {
      // Rollback complet : supprimer le compte Auth fraîchement créé (la
      // ligne profiles part avec, via ON DELETE CASCADE) et relâcher la
      // réclamation, pour ne laisser aucun compte à moitié initialisé.
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${newUserId}`, { method: "DELETE", headers: svcHeaders });
      await releaseInviteClaim(supabaseUrl, svcHeaders, token);
      const detail = await patchProfileRes.text();
      return jsonResponse({ error: "PROFILE_UPDATE_FAILED", detail }, 500);
    }

    return jsonResponse({ success: true, email: invite.email });
  } catch (err) {
    return jsonResponse({ error: "UNEXPECTED", detail: String(err) }, 500);
  }
}

async function releaseInviteClaim(
  supabaseUrl: string,
  svcHeaders: Record<string, string>,
  token: string,
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/rest/v1/client_invites?token=eq.${encodeURIComponent(token)}`, {
      method: "PATCH",
      headers: { ...svcHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ used_at: null }),
    });
  } catch (releaseErr) {
    console.error("complete-onboarding: échec de la libération du token après erreur:", releaseErr);
  }
}

declare const Deno:
  | { serve: (h: (req: Request) => Response | Promise<Response>) => void; env: { get(k: string): string | undefined } }
  | undefined;
if (typeof Deno !== "undefined") {
  Deno.serve((req) =>
    handleCompleteOnboardingRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    }),
  );
}
