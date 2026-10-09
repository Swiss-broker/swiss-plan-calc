import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleStripeWebhookRequest, type Env } from "./index";

const ENV: Env = {
  stripeKey: "sk_test_fake",
  supabaseUrl: "https://fake.supabase.co",
  supabaseKey: "fake-key",
  webhookSecret: "whsec_fake",
  brevoKey: "brevo_fake",
};

async function signedStripeRequest(event: Record<string, unknown>): Promise<Request> {
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(ENV.webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const signature = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return new Request("https://edge.local/stripe-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": `t=${timestamp},v1=${signature}`,
    },
    body: payload,
  });
}

function checkoutSessionCompletedEvent(opts: {
  mode: "payment" | "subscription";
  invoiceId?: string;
  brokerId?: string;
  clientId?: string;
  amountTotal?: number;
  paymentIntent?: string;
  email?: string;
}): Record<string, unknown> {
  return {
    id: "evt_test",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test",
        mode: opts.mode,
        amount_total: opts.amountTotal,
        payment_intent: opts.paymentIntent ?? "pi_real_123",
        customer_email: opts.email,
        metadata: {
          broker_id: opts.brokerId,
          client_id: opts.clientId,
          invoice_id: opts.invoiceId,
        },
      },
    },
  };
}

let patchedInvoices: Array<{ url: string; body: Record<string, unknown> }> = [];
let brevoCalls: Array<{ to: unknown; htmlContent: string }> = [];
// Simule la colonne commission_centimes de la ligne patchee, renvoyee via
// Prefer: return=representation. null = ancienne facture sans colonne
// figee, le webhook doit alors recalculer a la volee.
let frozenCommissionCentimes: number | null = null;
const profiles: Record<string, { email: string; first_name: string; plan?: string }> = {
  "broker-A": { email: "broker-a@x.ch", first_name: "Anna" },
};
const clients: Record<string, { first_name: string; last_name: string }> = {
  "client-1": { first_name: "Jean", last_name: "Dupont" },
};
const profilesByEmail: Record<string, { id: string; plan: string }> = {
  "nouveau@x.ch": { id: "broker-nouveau", plan: "trial" },
  "interne@x.ch": { id: "broker-interne", plan: "internal" },
  "demo@x.ch": { id: "broker-demo", plan: "demo" },
};
let patchedProfiles: Array<{ email: string; body: Record<string, unknown> }> = [];
let planEvents: Array<Record<string, unknown>> = [];

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";

  if (url.startsWith("https://fake.supabase.co/rest/v1/rdv_invoices") && method === "PATCH") {
    patchedInvoices.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
    return Promise.resolve(
      new Response(JSON.stringify([{ commission_centimes: frozenCommissionCentimes }]), {
        status: 200,
      }),
    );
  }
  if (url.includes("/rest/v1/profiles?id=eq.")) {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    const p = profiles[id];
    return Promise.resolve(new Response(JSON.stringify(p ? [p] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/profiles?email=eq.") && method === "GET") {
    const email = decodeURIComponent(url.match(/email=eq\.([^&]+)/)?.[1] ?? "");
    const p = profilesByEmail[email];
    return Promise.resolve(new Response(JSON.stringify(p ? [p] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/profiles?email=eq.") && method === "PATCH") {
    const email = decodeURIComponent(url.match(/email=eq\.([^&]+)/)?.[1] ?? "");
    patchedProfiles.push({ email, body: JSON.parse(String(init?.body ?? "{}")) });
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  if (url.includes("/rest/v1/plan_events") && method === "POST") {
    planEvents.push(JSON.parse(String(init?.body ?? "{}")));
    return Promise.resolve(new Response(null, { status: 201 }));
  }
  if (url.includes("/rest/v1/clients?id=eq.")) {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    const c = clients[id];
    return Promise.resolve(new Response(JSON.stringify(c ? [c] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/notifications")) {
    return Promise.resolve(new Response("", { status: 201 }));
  }
  if (url === "https://api.brevo.com/v3/smtp/email") {
    const body = JSON.parse(String(init?.body ?? "{}"));
    brevoCalls.push({ to: body.to, htmlContent: body.htmlContent });
    return Promise.resolve(new Response(JSON.stringify({}), { status: 201 }));
  }
  throw new Error(`URL non mockee: ${method} ${url}`);
}

beforeEach(() => {
  patchedInvoices = [];
  brevoCalls = [];
  frozenCommissionCentimes = null;
  patchedProfiles = [];
  planEvents = [];
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("stripe-webhook — signature", () => {
  it("refuse une requête sans en-tête stripe-signature", async () => {
    const req = new Request("https://edge.local/stripe-webhook", {
      method: "POST",
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    const res = await handleStripeWebhookRequest(req, ENV);
    expect(res.status).toBe(401);
    expect(patchedInvoices).toHaveLength(0);
  });

  it("refuse une signature invalide", async () => {
    const req = new Request("https://edge.local/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=bidon" },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    const res = await handleStripeWebhookRequest(req, ENV);
    expect(res.status).toBe(401);
    expect(patchedInvoices).toHaveLength(0);
  });
});

describe("stripe-webhook — paiement RDV : rattachement exact (régression du bug)", () => {
  it("ne met à jour QUE la facture dont l'id est dans les metadata, jamais une autre facture pending du même courtier", async () => {
    const event = checkoutSessionCompletedEvent({
      mode: "payment",
      invoiceId: "invoice-X",
      brokerId: "broker-A",
      clientId: "client-1",
      amountTotal: 250_000, // 2'500 CHF
    });
    const res = await handleStripeWebhookRequest(await signedStripeRequest(event), ENV);
    expect(res.status).toBe(200);

    expect(patchedInvoices).toHaveLength(1);
    expect(patchedInvoices[0].url).toContain("id=eq.invoice-X");
    expect(patchedInvoices[0].url).not.toContain("status=eq.pending");
    expect(patchedInvoices[0].body).toMatchObject({
      status: "paid",
      pdf_unlocked: true,
      stripe_payment_intent_id: "pi_real_123",
    });
  });

  it("sans invoice_id dans les metadata : aucune facture mise à jour (jamais de repli sur un filtre large)", async () => {
    const event = checkoutSessionCompletedEvent({
      mode: "payment",
      brokerId: "broker-A",
      clientId: "client-1",
      amountTotal: 150_00,
    });
    const res = await handleStripeWebhookRequest(await signedStripeRequest(event), ENV);
    expect(res.status).toBe(200);
    expect(patchedInvoices).toHaveLength(0);
  });

  it("la commission par tranches (2'500 CHF -> 550 CHF) apparaît correctement dans l'email courtier, sans '10%' codé en dur", async () => {
    const event = checkoutSessionCompletedEvent({
      mode: "payment",
      invoiceId: "invoice-X",
      brokerId: "broker-A",
      clientId: "client-1",
      amountTotal: 250_000,
    });
    await handleStripeWebhookRequest(await signedStripeRequest(event), ENV);

    expect(brevoCalls).toHaveLength(1);
    const html = brevoCalls[0].htmlContent;
    // L'ancien texte codé en dur ignorait la grille réelle ; le nouveau
    // détail par tranche peut légitimement mentionner "10%)" pour la
    // tranche au-delà de 2'000 CHF, ce n'est pas la même chose.
    expect(html).not.toContain("Commission SwissBroker Pro (10%)");
    expect(html).toContain("30%");
    expect(html).toContain("20%");
    expect(html).toContain("550.00 CHF");
    expect(html).toContain("1950.00 CHF");
  });

  it("utilise la commission FIGÉE à la facturation (commission_centimes), pas un recalcul live si elle diffère", async () => {
    // Simule un barème qui aurait changé entre la facturation et le
    // paiement : la commission réellement figée (et réellement prélevée
    // par Stripe via application_fee_amount) était 40'000 centimes, pas ce
    // que le barème ACTUEL donnerait pour ce montant.
    frozenCommissionCentimes = 40_000;
    const event = checkoutSessionCompletedEvent({
      mode: "payment",
      invoiceId: "invoice-X",
      brokerId: "broker-A",
      clientId: "client-1",
      amountTotal: 250_000,
    });
    await handleStripeWebhookRequest(await signedStripeRequest(event), ENV);

    const html = brevoCalls[0].htmlContent;
    expect(html).toContain("400.00 CHF"); // commission figée, pas 550.00 (le calcul live)
    expect(html).toContain("2100.00 CHF"); // 2500 - 400, pas 1950.00
  });

  it("sans commission figée (vieille facture d'avant la colonne) : recalcule à la volée avec le barème actuel", async () => {
    frozenCommissionCentimes = null;
    const event = checkoutSessionCompletedEvent({
      mode: "payment",
      invoiceId: "invoice-X",
      brokerId: "broker-A",
      clientId: "client-1",
      amountTotal: 250_000,
    });
    await handleStripeWebhookRequest(await signedStripeRequest(event), ENV);

    const html = brevoCalls[0].htmlContent;
    expect(html).toContain("550.00 CHF");
  });
});

describe("stripe-webhook — cotisation annuelle (plus de sélection de plan ni de cabinet)", () => {
  it("un paiement de cotisation accorde le plan 'active', journalisé dans plan_events", async () => {
    const event = checkoutSessionCompletedEvent({ mode: "subscription", email: "nouveau@x.ch" });
    const res = await handleStripeWebhookRequest(await signedStripeRequest(event), ENV);
    expect(res.status).toBe(200);

    expect(patchedProfiles).toHaveLength(1);
    expect(patchedProfiles[0].email).toBe("nouveau@x.ch");
    expect(patchedProfiles[0].body).toEqual({ plan: "active" });

    expect(planEvents).toHaveLength(1);
    expect(planEvents[0]).toMatchObject({
      broker_id: "broker-nouveau",
      previous_plan: "trial",
      new_plan: "active",
      reason: "checkout_completed",
    });
  });

  it("un compte internal n'est jamais rétrogradé/modifié par ce webhook", async () => {
    const event = checkoutSessionCompletedEvent({ mode: "subscription", email: "interne@x.ch" });
    await handleStripeWebhookRequest(await signedStripeRequest(event), ENV);
    expect(patchedProfiles).toHaveLength(0);
    expect(planEvents).toHaveLength(0);
  });

  it("un compte demo n'est jamais modifié par ce webhook", async () => {
    const event = checkoutSessionCompletedEvent({ mode: "subscription", email: "demo@x.ch" });
    await handleStripeWebhookRequest(await signedStripeRequest(event), ENV);
    expect(patchedProfiles).toHaveLength(0);
    expect(planEvents).toHaveLength(0);
  });
});

describe("stripe-webhook — payment_intent.succeeded (filet de sécurité)", () => {
  it("avec invoice_id en metadata : débloque la bonne facture", async () => {
    const event = {
      id: "evt_pi",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_real_456", metadata: { invoice_id: "invoice-Y" } } },
    };
    const res = await handleStripeWebhookRequest(await signedStripeRequest(event), ENV);
    expect(res.status).toBe(200);
    expect(patchedInvoices).toHaveLength(1);
    expect(patchedInvoices[0].url).toContain("id=eq.invoice-Y");
    expect(patchedInvoices[0].body).toMatchObject({
      status: "paid",
      pdf_unlocked: true,
      stripe_payment_intent_id: "pi_real_456",
    });
  });

  it("sans invoice_id en metadata (vieux PaymentIntent orphelin éventuel) : aucune mise à jour, pas de crash", async () => {
    const event = {
      id: "evt_pi2",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_orphan", metadata: {} } },
    };
    const res = await handleStripeWebhookRequest(await signedStripeRequest(event), ENV);
    expect(res.status).toBe(200);
    expect(patchedInvoices).toHaveLength(0);
  });
});
