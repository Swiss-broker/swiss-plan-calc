// supabase/functions/generate-offer/index.ts
// Génère un lien de paiement Stripe (Checkout Session) pour un lead
// demo_requests, depuis le panel admin/commercial (swiss-broker-admin).
// Réservé à is_staff() (admin OU commercial) — vérifié côté serveur via
// admin_users, jamais via une prétention du client.
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
const ALLOWED_BILLING_PERIODS = new Set(["monthly", "annual"]);
const ALLOWED_DISCOUNT_DURATIONS = new Set(["none", "once", "3_months", "6_months", "12_months", "forever"]);
const REPEATING_MONTHS: Record<string, number> = { "3_months": 3, "6_months": 6, "12_months": 12 };

/** Identité vérifiée depuis le JWT (déjà validé par la passerelle Supabase,
 * verify_jwt=true). Ne jamais faire confiance à un id envoyé dans le body. */
function getVerifiedUserId(req: Request): string {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
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

export type Env = {
  supabaseUrl: string;
  supabaseKey: string;
  stripeKey: string;
  starterMonthly?: string;
  starterYearly?: string;
  proMonthly?: string;
  proYearly?: string;
  cabinetMonthly?: string;
  cabinetYearly?: string;
  siteUrl: string;
};

export async function handleGenerateOfferRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      supabaseUrl, supabaseKey, stripeKey,
      starterMonthly, starterYearly, proMonthly, proYearly, cabinetMonthly, cabinetYearly,
      siteUrl,
    } = env;
    if (!supabaseUrl || !supabaseKey) return jsonResponse({ error: "CONFIG_MISSING" }, 500);
    if (!stripeKey) return jsonResponse({ error: "STRIPE_SECRET_KEY manquante." }, 500);

    const callerId = getVerifiedUserId(req);
    const { demo_request_id, plan, billing_period, discount_percent, discount_duration } = await req.json();

    if (!demo_request_id || typeof demo_request_id !== "string") {
      return jsonResponse({ error: "demo_request_id manquant." }, 400);
    }
    if (!plan || !ALLOWED_PLANS.has(plan)) {
      return jsonResponse({ error: "Plan invalide (attendu : starter, pro ou cabinet)." }, 400);
    }
    if (!billing_period || !ALLOWED_BILLING_PERIODS.has(billing_period)) {
      return jsonResponse({ error: "billing_period invalide (attendu : monthly ou annual)." }, 400);
    }
    if (!discount_duration || !ALLOWED_DISCOUNT_DURATIONS.has(discount_duration)) {
      return jsonResponse({
        error: "discount_duration invalide (attendu : none, once, 3_months, 6_months, 12_months ou forever).",
      }, 400);
    }
    let discountPercent: number | null = null;
    if (discount_duration !== "none") {
      // 'none' ignore discount_percent même si fourni ; toute autre durée
      // sans pourcentage valide n'a pas de sens (une durée sans remise).
      if (discount_percent === undefined || discount_percent === null || discount_percent === 0) {
        return jsonResponse({
          error: "discount_duration a été fourni sans discount_percent : une durée de remise sans pourcentage n'a pas de sens.",
        }, 400);
      }
      discountPercent = Number(discount_percent);
      if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
        return jsonResponse({ error: "discount_percent doit être un nombre entre 0 et 100." }, 400);
      }
    }

    const svcHeaders = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    };

    // is_staff() vérifié côté serveur : n'importe quel membre de
    // admin_users (admin ou commercial), jamais une prétention du client.
    const staffRes = await fetch(
      `${supabaseUrl}/rest/v1/admin_users?user_id=eq.${callerId}&select=user_id,role`,
      { headers: svcHeaders },
    );
    const staffRows = await staffRes.json();
    if (!Array.isArray(staffRows) || staffRows.length === 0) {
      return jsonResponse({ error: "Réservé aux membres de l'équipe (admin ou commercial)." }, 403);
    }
    const callerRole = staffRows[0].role as string;

    // Le lead doit exister ; un commercial ne peut générer une offre que
    // pour un lead qui lui est assigné (même restriction que la RLS sur
    // demo_requests), un admin peut le faire pour n'importe lequel.
    const leadRes = await fetch(
      `${supabaseUrl}/rest/v1/demo_requests?id=eq.${demo_request_id}&select=id,name,email,assigned_to`,
      { headers: svcHeaders },
    );
    const leadRows = await leadRes.json();
    if (!Array.isArray(leadRows) || leadRows.length === 0) {
      return jsonResponse({ error: "Lead introuvable." }, 404);
    }
    const lead = leadRows[0];
    if (callerRole !== "admin" && lead.assigned_to !== callerId) {
      return jsonResponse({ error: "Ce lead ne vous est pas assigné." }, 403);
    }

    // Correspondance plan + période -> Price ID, lue depuis les mêmes
    // secrets que le flux self-serve existant (stripe-checkout) — jamais
    // de price_id en dur ici.
    const PRICE_BY_PLAN_AND_PERIOD: Record<string, Record<string, string | undefined>> = {
      starter: { monthly: starterMonthly, annual: starterYearly },
      pro: { monthly: proMonthly, annual: proYearly },
      cabinet: { monthly: cabinetMonthly, annual: cabinetYearly },
    };
    const priceId = PRICE_BY_PLAN_AND_PERIOD[plan][billing_period];
    if (!priceId) {
      const secretSuffix = billing_period === "annual" ? "YEARLY" : "MONTHLY";
      return jsonResponse({
        error: `Price ID manquant pour le plan "${plan}" en période "${billing_period}" (secret STRIPE_${plan.toUpperCase()}_${secretSuffix} non configuré).`,
      }, 500);
    }

    // Coupon à la volée si une remise est demandée, avec la durée choisie :
    // 'once' (première facture seulement), '3_months'/'6_months'/'12_months'
    // (duration=repeating), ou 'forever' (tant que l'abonnement existe).
    let couponId: string | null = null;
    if (discountPercent !== null) {
      const couponBody: Record<string, string> = {
        percent_off: String(discountPercent),
        name: `Offre commerciale ${discountPercent}% — lead ${lead.name}`,
      };
      if (discount_duration in REPEATING_MONTHS) {
        couponBody.duration = "repeating";
        couponBody.duration_in_months = String(REPEATING_MONTHS[discount_duration]);
      } else {
        // 'once' ou 'forever' : la valeur de discount_duration est déjà
        // le mot-clé Stripe attendu tel quel.
        couponBody.duration = discount_duration;
      }
      const couponRes = await fetch("https://api.stripe.com/v1/coupons", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(couponBody).toString(),
      });
      const coupon = await couponRes.json();
      if (!couponRes.ok) {
        return jsonResponse({ error: coupon.error?.message ?? "Erreur Stripe lors de la création du coupon." }, 500);
      }
      couponId = coupon.id;
    }

    // Checkout Session : demo_request_id passé en metadata, indispensable
    // pour que le futur webhook de conversion retrouve quel lead a payé.
    const params: Record<string, string> = {
      "payment_method_types[0]": "card",
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      customer_email: lead.email,
      success_url: `${siteUrl}/auth?paiement=ok`,
      cancel_url: `${siteUrl}/`,
      "metadata[demo_request_id]": demo_request_id,
      "metadata[plan]": plan,
      "metadata[billing_period]": billing_period,
      "metadata[generated_by]": callerId,
      "subscription_data[metadata][demo_request_id]": demo_request_id,
      "subscription_data[metadata][plan]": plan,
      "subscription_data[metadata][billing_period]": billing_period,
    };
    if (couponId) params["discounts[0][coupon]"] = couponId;

    const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    });
    const session = await sessionRes.json();
    if (!sessionRes.ok) {
      return jsonResponse({ error: session.error?.message ?? "Erreur Stripe lors de la création du Checkout Session." }, 500);
    }

    // Journalisation best-effort : l'offre est déjà générée à ce stade,
    // une erreur de journalisation ne doit pas faire échouer la réponse.
    try {
      await fetch(`${supabaseUrl}/rest/v1/admin_actions`, {
        method: "POST",
        headers: { ...svcHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({
          admin_id: callerId,
          action: "generate_offer",
          target_type: "demo_request",
          target_id: demo_request_id,
          details: {
            plan,
            billing_period,
            discount_duration,
            discount_percent: discountPercent,
            coupon_id: couponId,
            checkout_session_id: session.id,
            caller_role: callerRole,
          },
        }),
      });
    } catch (logErr) {
      console.error("Erreur journalisation admin_actions (offre déjà générée):", logErr);
    }

    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error("Erreur generate-offer:", err);
    return jsonResponse({ error: String(err instanceof Error ? err.message : err) }, 400);
  }
}

// `Deno` n'existe pas sous Node/Vitest : ce garde-fou permet d'importer ce
// fichier depuis les tests sans jamais tenter de démarrer un vrai serveur
// Deno en dehors du runtime Edge Functions.
declare const Deno:
  | {
      serve: (h: (req: Request) => Response | Promise<Response>) => void;
      env: { get(k: string): string | undefined };
    }
  | undefined;
if (typeof Deno !== "undefined") {
  Deno.serve((req) =>
    handleGenerateOfferRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      stripeKey: Deno.env.get("STRIPE_SECRET_KEY") ?? "",
      starterMonthly: Deno.env.get("STRIPE_STARTER_MONTHLY"),
      starterYearly: Deno.env.get("STRIPE_STARTER_YEARLY"),
      proMonthly: Deno.env.get("STRIPE_PRO_MONTHLY"),
      proYearly: Deno.env.get("STRIPE_PRO_YEARLY"),
      cabinetMonthly: Deno.env.get("STRIPE_CABINET_MONTHLY"),
      cabinetYearly: Deno.env.get("STRIPE_CABINET_YEARLY"),
      siteUrl: Deno.env.get("SITE_URL") ?? "https://swissbrokerpro.ch",
    }),
  );
}
