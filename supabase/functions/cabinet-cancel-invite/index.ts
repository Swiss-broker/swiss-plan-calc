// supabase/functions/cabinet-cancel-invite/index.ts
// Annule une invitation en attente : retire le siège de l'abonnement
// Stripe (fin de la facturation) et marque l'invitation comme révoquée.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Le compte appelant est deduit du JWT verifie par la passerelle Supabase
// (verify_jwt=true sur cette fonction : la signature est deja validee avant
// que ce code ne s'execute), jamais d'un champ du body. Decoder le payload
// sans re-verifier la signature est donc sur ici, et empeche toute
// usurpation d'identite via un id envoye par l'appelant.
function getCallerFromJwt(req: Request): { id: string; email: string | null } | null {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded));
    if (typeof payload?.sub !== "string") return null;
    return { id: payload.sub, email: typeof payload.email === "string" ? payload.email : null };
  } catch {
    return null;
  }
}

export type Env = { supabaseUrl: string; supabaseKey: string; stripeKey: string };

export async function handleCabinetCancelInviteRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { inviteId } = await req.json();
    if (!inviteId) throw new Error("Paramètres manquants.");

    const caller = getCallerFromJwt(req);
    if (!caller) throw new Error("Authentification requise.");
    const requesterId = caller.id;

    const { supabaseUrl, supabaseKey, stripeKey } = env;
    if (!stripeKey || !supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    // Récupérer l'invitation, et vérifier que celui qui annule est bien
    // celui qui l'a envoyée (sécurité minimale : on ne laisse pas
    // n'importe qui annuler l'invitation de quelqu'un d'autre).
    const inviteRes = await fetch(
      `${supabaseUrl}/rest/v1/cabinet_invites?id=eq.${inviteId}&select=*`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    );
    const invites = await inviteRes.json();
    const invite = invites[0];
    if (!invite) throw new Error("Invitation introuvable.");
    if (invite.invited_by !== requesterId)
      throw new Error("Vous ne pouvez annuler que vos propres invitations.");
    if (invite.status !== "pending") throw new Error("Cette invitation n'est plus en attente.");

    // Retirer le siège de l'abonnement Stripe, pour arrêter la facturation.
    if (invite.stripe_subscription_item_id) {
      await fetch(
        `https://api.stripe.com/v1/subscription_items/${invite.stripe_subscription_item_id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ proration_behavior: "always_invoice" }).toString(),
        },
      );
    }

    await fetch(`${supabaseUrl}/rest/v1/cabinet_invites?id=eq.${inviteId}`, {
      method: "PATCH",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status: "revoked" }),
    });

    return new Response(JSON.stringify({ cancelled: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// `Deno` n'existe pas sous Node/Vitest : ce garde-fou permet d'importer ce
// fichier depuis les tests sans jamais tenter de demarrer un vrai serveur
// Deno en dehors du runtime Edge Functions.
declare const Deno:
  | {
      serve: (h: (req: Request) => Response | Promise<Response>) => void;
      env: { get(k: string): string | undefined };
    }
  | undefined;
if (typeof Deno !== "undefined") {
  Deno.serve((req) =>
    handleCabinetCancelInviteRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      stripeKey: Deno.env.get("STRIPE_SECRET_KEY") ?? "",
    }),
  );
}
