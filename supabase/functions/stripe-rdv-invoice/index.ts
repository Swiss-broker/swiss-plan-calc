import { RDV_MIN_CENTIMES, computeCommissionCentimes } from "../_shared/commission.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Le compte appelant est deduit du JWT verifie par la passerelle Supabase
// (verify_jwt=true sur cette fonction : la signature est deja validee avant
// que ce code ne s'execute), jamais d'un champ du body. Decoder le payload
// sans re-verifier la signature est donc sur ici, et empeche qu'un
// utilisateur facture sur le compte Stripe Connect de quelqu'un d'autre.
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

export async function handleStripeRdvInvoiceRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { clientId, amountChf, description, returnUrl } = await req.json();

    if (!amountChf) throw new Error("Montant manquant.");
    const amountCentimes = Math.round(amountChf * 100);
    if (amountCentimes < RDV_MIN_CENTIMES) {
      throw new Error("Le montant minimum de facturation est de 150 CHF.");
    }

    const caller = getCallerFromJwt(req);
    if (!caller) throw new Error("Authentification requise.");
    const brokerId = caller.id;

    const { supabaseUrl, supabaseKey, stripeKey } = env;
    if (!stripeKey || !supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    // Récupérer le compte Connect du courtier
    const accountRes = await fetch(
      `${supabaseUrl}/rest/v1/broker_connect_accounts?broker_id=eq.${brokerId}&select=stripe_account_id,onboarding_complete`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    );
    const accounts = await accountRes.json();

    if (!accounts.length || !accounts[0].onboarding_complete) {
      throw new Error(
        "Compte bancaire non configuré. Veuillez d'abord connecter votre compte bancaire dans votre profil.",
      );
    }

    const stripeAccountId = accounts[0].stripe_account_id;

    // Commission SwissBroker Pro par tranches marginales, voir _shared/commission.ts.
    const applicationFee = computeCommissionCentimes(amountCentimes);

    // Récupère l'identité actuelle du client pour figer un instantané
    // au moment du paiement (empêche le déblocage PDF de survivre à un
    // changement d'identité sur la fiche client).
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
      // broker_id=eq.${brokerId} est essentiel ici : sans ce filtre, un
      // courtier pourrait facturer en référence au client d'un AUTRE
      // courtier (fuite de données personnelles dans l'instantané, et
      // facture rattachée à un client qui n'est pas le sien).
      const clientRes = await fetch(
        `${supabaseUrl}/rest/v1/clients?id=eq.${clientId}&broker_id=eq.${brokerId}&select=first_name,last_name,date_of_birth,gender,nationality,email`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
      );
      const clientBody = await clientRes.json();
      if (!clientRes.ok) {
        throw new Error("Erreur de vérification du client.");
      }
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

    // Identifiant de la facture, généré AVANT tout appel Stripe : il part
    // dans les metadata du Payment Link pour que le webhook puisse ensuite
    // rattacher le paiement à CETTE facture précise, jamais à "une facture
    // pending de ce courtier" au hasard (voir le correctif dans
    // stripe-webhook). Sert aussi de clé primaire explicite à l'insertion
    // plus bas, donc déjà connu avant que la ligne existe en base.
    const invoiceId = crypto.randomUUID();

    // Créer un Payment Link Stripe pour partager facilement
    const plRes = await fetch("https://api.stripe.com/v1/prices", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        unit_amount: String(amountCentimes),
        currency: "chf",
        "product_data[name]": description || "Conseil en prévoyance",
      }).toString(),
    });
    const price = await plRes.json();

    const linkRes = await fetch("https://api.stripe.com/v1/payment_links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "line_items[0][price]": price.id,
        "line_items[0][quantity]": "1",
        "transfer_data[destination]": stripeAccountId,
        application_fee_amount: String(applicationFee),
        "metadata[broker_id]": brokerId,
        "metadata[client_id]": clientId || "",
        "metadata[invoice_id]": invoiceId,
        "after_completion[type]": "hosted_confirmation",
        "after_completion[hosted_confirmation][custom_message]":
          "Merci pour votre paiement. Votre courtier a été notifié.",
      }).toString(),
    });
    const paymentLink = await linkRes.json();
    if (!linkRes.ok) throw new Error(paymentLink.error?.message ?? "Erreur création lien");

    // Sauvegarder la facture en base, avec l'instantané d'identité du client
    const invoiceInsertRes = await fetch(`${supabaseUrl}/rest/v1/rdv_invoices`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        id: invoiceId,
        broker_id: brokerId,
        client_id: clientId || null,
        amount_chf: amountCentimes,
        // Figée ici une fois pour toutes : si le barème de commission
        // change un jour, cette facture garde la commission réellement
        // annoncée au courtier au moment où il l'a envoyée, pas un montant
        // recalculé après coup avec un barème différent.
        commission_centimes: applicationFee,
        // Pas encore connu : un Payment Link n'est lié à un vrai
        // PaymentIntent qu'au moment où quelqu'un le paie réellement.
        // stripe-webhook le renseignera avec le PaymentIntent réel dès que
        // le paiement aboutit (checkout.session.completed).
        stripe_payment_intent_id: null,
        stripe_payment_link: paymentLink.url,
        status: "pending",
        pdf_unlocked: false,
        ...snapshot,
      }),
    });
    if (!invoiceInsertRes.ok) {
      const errBody = await invoiceInsertRes.text();
      console.error("Erreur insertion rdv_invoices:", invoiceInsertRes.status, errBody);
    }

    return new Response(
      JSON.stringify({
        paymentLink: paymentLink.url,
        amountChf,
        commission: applicationFee / 100,
        brokerReceives: (amountCentimes - applicationFee) / 100,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
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
    handleStripeRdvInvoiceRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      stripeKey: Deno.env.get("STRIPE_SECRET_KEY") ?? "",
    }),
  );
}
