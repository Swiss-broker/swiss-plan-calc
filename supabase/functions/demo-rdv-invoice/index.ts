const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Même raisonnement que stripe-rdv-invoice : le compte appelant est déduit
// du JWT déjà vérifié par la passerelle Supabase (verify_jwt=true), jamais
// d'un champ du body.
function getCallerFromJwt(req: Request): { id: string } | null {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded));
    if (typeof payload?.sub !== "string") return null;
    return { id: payload.sub };
  } catch {
    return null;
  }
}

export type Env = { supabaseUrl: string; supabaseKey: string };

export async function handleDemoRdvInvoiceRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { clientId, amountChf } = await req.json();

    if (!amountChf || amountChf < 80) {
      throw new Error("Le montant minimum de facturation est de 80 CHF.");
    }

    const caller = getCallerFromJwt(req);
    if (!caller) throw new Error("Authentification requise.");
    const brokerId = caller.id;

    const { supabaseUrl, supabaseKey } = env;
    if (!supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    // Vérification serveur, jamais côté client : seul un compte réellement
    // plan='demo' en base peut emprunter ce chemin. Un compte de production
    // qui appellerait cette fonction directement (dev tools, etc.) au lieu
    // de stripe-rdv-invoice se ferait refuser ici, quoi qu'il envoie.
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${brokerId}&select=plan`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    );
    const profiles = await profileRes.json();
    if (!profiles[0] || profiles[0].plan !== "demo") {
      throw new Error("Cette fonction est réservée aux comptes en mode démo.");
    }

    // Même instantané d'identité que stripe-rdv-invoice, pour que le
    // reverrouillage automatique (sync_pdf_unlock_with_identity) se
    // comporte de façon identique en démo — réalisme du parcours.
    let snapshot: {
      snapshot_first_name: string | null;
      snapshot_last_name: string | null;
      snapshot_date_of_birth: string | null;
      snapshot_gender: string | null;
      snapshot_nationality: string | null;
      snapshot_email: string | null;
    } = {
      snapshot_first_name: null,
      snapshot_last_name: null,
      snapshot_date_of_birth: null,
      snapshot_gender: null,
      snapshot_nationality: null,
      snapshot_email: null,
    };
    if (clientId) {
      const clientRes = await fetch(
        `${supabaseUrl}/rest/v1/clients?id=eq.${clientId}&broker_id=eq.${brokerId}&select=first_name,last_name,date_of_birth,gender,nationality,email`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
      );
      const clientBody = await clientRes.json();
      if (!clientRes.ok) throw new Error("Erreur de vérification du client.");
      if (!Array.isArray(clientBody) || clientBody.length === 0) {
        throw new Error("Ce client n'existe pas ou ne vous appartient pas.");
      }
      const c = clientBody[0];
      snapshot = {
        snapshot_first_name: c.first_name ?? null,
        snapshot_last_name: c.last_name ?? null,
        snapshot_date_of_birth: c.date_of_birth ?? null,
        snapshot_gender: c.gender ?? null,
        snapshot_nationality: c.nationality ?? null,
        snapshot_email: c.email ?? null,
      };
    }

    const amountCentimes = Math.round(amountChf * 100);

    // Identifiants clairement non-Stripe : préfixe "demo_" (un vrai
    // payment_intent Stripe commence toujours par "pi_"), et lien pointant
    // vers un chemin qui n'existe sur aucun serveur de paiement réel —
    // aucun appel à l'API Stripe n'a lieu dans cette fonction.
    const fakeId = crypto.randomUUID();
    const stripePaymentIntentId = `demo_pi_${fakeId}`;
    const stripePaymentLink = `https://swissbrokerpro.ch/demo/paiement-simule/${fakeId}`;

    const invoiceInsertRes = await fetch(`${supabaseUrl}/rest/v1/rdv_invoices`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        broker_id: brokerId,
        client_id: clientId || null,
        amount_chf: amountCentimes,
        stripe_payment_intent_id: stripePaymentIntentId,
        stripe_payment_link: stripePaymentLink,
        status: "paid",
        pdf_unlocked: true,
        is_demo: true,
        ...snapshot,
      }),
    });
    if (!invoiceInsertRes.ok) {
      const errBody = await invoiceInsertRes.text();
      console.error("Erreur insertion rdv_invoices (démo):", invoiceInsertRes.status, errBody);
      throw new Error("Erreur lors de la création de la facture démo.");
    }

    return new Response(
      JSON.stringify({
        paymentLink: stripePaymentLink,
        paymentIntentId: stripePaymentIntentId,
        amountChf,
        commission: 0,
        brokerReceives: amountChf,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
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
    handleDemoRdvInvoiceRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    }),
  );
}
