// supabase/functions/open-offer/index.ts
// Ouverture d'un lien d'offre par un prospect (page publique
// swissbrokerpro.ch/offre/{token}, sans compte) : vérifie l'offre et crée
// une page de paiement Stripe neuve, valable 24 h, à chaque ouverture. Le
// lien envoyé reste ainsi utilisable pendant toute la durée de l'offre.
// Endpoint public (verify_jwt=false) : toute l'identité vient du token.
import { isOfferToken, offerCheckoutParams } from "../_shared/offer-checkout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export type Env = {
  supabaseUrl: string;
  supabaseKey: string;
  stripeKey: string;
  cotisationPriceId?: string;
  siteUrl: string;
};

export async function handleOpenOfferRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { supabaseUrl, supabaseKey, stripeKey, cotisationPriceId, siteUrl } = env;
    if (!supabaseUrl || !supabaseKey || !stripeKey || !cotisationPriceId) {
      return jsonResponse({ error: "CONFIG_MISSING" }, 500);
    }
    const body = await req.json().catch(() => ({}));
    const token = body?.token;
    if (!isOfferToken(token)) return jsonResponse({ error: "OFFER_NOT_FOUND" }, 404);

    const svcHeaders = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };
    const offerRes = await fetch(
      `${supabaseUrl}/rest/v1/lead_offers?token=eq.${token}&select=id,demo_request_id,coupon_id,created_by,expires_at,open_count`,
      { headers: svcHeaders },
    );
    const offers = await offerRes.json();
    const offer = Array.isArray(offers) ? offers[0] : null;
    if (!offer) return jsonResponse({ error: "OFFER_NOT_FOUND" }, 404);
    if (new Date(offer.expires_at) < new Date()) return jsonResponse({ error: "OFFER_EXPIRED" }, 410);

    const leadRes = await fetch(
      `${supabaseUrl}/rest/v1/demo_requests?id=eq.${offer.demo_request_id}&select=id,email,status`,
      { headers: svcHeaders },
    );
    const leads = await leadRes.json();
    const lead = Array.isArray(leads) ? leads[0] : null;
    if (!lead) return jsonResponse({ error: "OFFER_NOT_FOUND" }, 404);
    // Déjà payé : ne pas proposer de payer une seconde fois.
    if (lead.status === "converted") return jsonResponse({ error: "OFFER_ALREADY_PAID" }, 409);

    const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(
        offerCheckoutParams({
          priceId: cotisationPriceId,
          leadEmail: lead.email,
          demoRequestId: lead.id,
          generatedBy: offer.created_by ?? null,
          couponId: offer.coupon_id ?? null,
          siteUrl,
        }),
      ).toString(),
    });
    const session = await sessionRes.json();
    if (!sessionRes.ok || !session?.url) {
      console.error("open-offer : échec Stripe", sessionRes.status, session?.error?.message);
      return jsonResponse({ error: "CHECKOUT_FAILED" }, 502);
    }

    // Suivi best-effort pour le commercial (dernière ouverture, nombre).
    await fetch(`${supabaseUrl}/rest/v1/lead_offers?id=eq.${offer.id}`, {
      method: "PATCH",
      headers: { ...svcHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        last_opened_at: new Date().toISOString(),
        open_count: Number(offer.open_count ?? 0) + 1,
      }),
    }).catch(() => undefined);

    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error("Erreur open-offer:", err);
    return jsonResponse({ error: "CHECKOUT_FAILED" }, 500);
  }
}

declare const Deno:
  | {
      serve: (h: (req: Request) => Response | Promise<Response>) => void;
      env: { get(k: string): string | undefined };
    }
  | undefined;
if (typeof Deno !== "undefined") {
  Deno.serve((req) =>
    handleOpenOfferRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      stripeKey: Deno.env.get("STRIPE_SECRET_KEY") ?? "",
      cotisationPriceId: Deno.env.get("STRIPE_COTISATION_ANNUELLE"),
      siteUrl: Deno.env.get("SITE_URL") ?? "https://swissbrokerpro.ch",
    }),
  );
}
