import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleCheckStuckRdvPaymentsRequest, type Env } from "./index";

const ENV: Env = {
  supabaseUrl: "https://fake.supabase.co",
  supabaseKey: "fake-key",
  stripeKey: "sk_test_fake",
};

function req(token: string | null): Request {
  const headers: Record<string, string> = {};
  if (token) headers["x-internal-token"] = token;
  return new Request("https://edge.local/check-stuck-rdv-payments", { method: "POST", headers });
}

let patchedInvoices: Array<{ url: string; body: Record<string, unknown> }> = [];
let searchedInvoiceIds: string[] = [];
let authorized = true;
const stuckInvoices: { id: string; broker_id: string }[] = [
  { id: "invoice-stuck-1", broker_id: "broker-A" },
];
// Retourne "succeeded" pour cet id lors de la recherche Stripe, sinon aucun résultat.
let stripeSucceededFor: string | null = null;

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";

  if (url.includes("/rest/v1/rpc/verify_internal_alert_token")) {
    return Promise.resolve(new Response(JSON.stringify(authorized), { status: 200 }));
  }
  if (url.includes("/rest/v1/rdv_invoices") && method === "GET") {
    return Promise.resolve(new Response(JSON.stringify(stuckInvoices), { status: 200 }));
  }
  if (url.includes("/rest/v1/rdv_invoices") && method === "PATCH") {
    patchedInvoices.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  if (url.startsWith("https://api.stripe.com/v1/payment_intents/search")) {
    const match = url.match(/metadata%5B'invoice_id'%5D%3A'([^']+)'/);
    const invoiceId = match ? decodeURIComponent(match[1]) : null;
    if (invoiceId) searchedInvoiceIds.push(invoiceId);
    const found = invoiceId && invoiceId === stripeSucceededFor;
    return Promise.resolve(
      new Response(
        JSON.stringify({ data: found ? [{ id: "pi_found", status: "succeeded" }] : [] }),
        {
          status: 200,
        },
      ),
    );
  }
  if (url.includes("/rest/v1/admin_users")) {
    return Promise.resolve(new Response(JSON.stringify([{ user_id: "admin-1" }]), { status: 200 }));
  }
  if (url.includes("/rest/v1/admin_notifications")) {
    return Promise.resolve(new Response(null, { status: 201 }));
  }
  throw new Error(`URL non mockee: ${method} ${url}`);
}

beforeEach(() => {
  patchedInvoices = [];
  searchedInvoiceIds = [];
  authorized = true;
  stripeSucceededFor = null;
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("check-stuck-rdv-payments", () => {
  it("refuse sans jeton interne valide", async () => {
    authorized = false;
    const res = await handleCheckStuckRdvPaymentsRequest(req("mauvais-jeton"), ENV);
    expect(res.status).toBe(401);
    expect(patchedInvoices).toHaveLength(0);
  });

  it("cherche le paiement par metadata.invoice_id, pas par un id de PaymentIntent connu à l'avance", async () => {
    await handleCheckStuckRdvPaymentsRequest(req("bon-jeton"), ENV);
    expect(searchedInvoiceIds).toContain("invoice-stuck-1");
  });

  it("facture toujours impayée chez Stripe : rien ne change", async () => {
    const res = await handleCheckStuckRdvPaymentsRequest(req("bon-jeton"), ENV);
    const body = await res.json();
    expect(body.corrected).toBe(0);
    expect(patchedInvoices).toHaveLength(0);
  });

  it("paiement réellement abouti chez Stripe mais webhook manqué : la facture est corrigée avec le vrai PaymentIntent", async () => {
    stripeSucceededFor = "invoice-stuck-1";
    const res = await handleCheckStuckRdvPaymentsRequest(req("bon-jeton"), ENV);
    const body = await res.json();
    expect(body.corrected).toBe(1);
    expect(patchedInvoices).toHaveLength(1);
    expect(patchedInvoices[0].url).toContain("id=eq.invoice-stuck-1");
    expect(patchedInvoices[0].body).toMatchObject({
      status: "paid",
      pdf_unlocked: true,
      stripe_payment_intent_id: "pi_found",
    });
  });
});
