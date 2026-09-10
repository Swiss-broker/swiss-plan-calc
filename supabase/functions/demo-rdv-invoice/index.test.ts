import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleDemoRdvInvoiceRequest, type Env } from "./index";

const ENV: Env = { supabaseUrl: "https://fake.supabase.co", supabaseKey: "fake-key" };

function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.fakesig`;
}

function reqWithAuth(userId: string | null, body: Record<string, unknown>): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (userId) headers.Authorization = `Bearer ${fakeJwt({ sub: userId })}`;
  return new Request("https://edge.local/demo-rdv-invoice", { method: "POST", headers, body: JSON.stringify(body) });
}

const profiles: Record<string, { plan: string }> = {
  "broker-demo": { plan: "demo" },
  "broker-prod": { plan: "pro" },
};

const clients: Record<string, { broker_id: string; first_name: string }> = {
  "client-of-demo": { broker_id: "broker-demo", first_name: "Jean" },
  "client-of-other": { broker_id: "broker-other", first_name: "Secret" },
};

let insertedInvoices: Record<string, unknown>[] = [];

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  if (url.includes("/rest/v1/profiles?id=eq.")) {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    const p = profiles[id];
    return Promise.resolve(new Response(JSON.stringify(p ? [p] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/clients?id=eq.")) {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    const brokerFilter = decodeURIComponent(url.match(/broker_id=eq\.([^&]+)/)?.[1] ?? "");
    const c = clients[id];
    const match = c && c.broker_id === brokerFilter ? [c] : [];
    return Promise.resolve(new Response(JSON.stringify(match), { status: 200 }));
  }
  if (url.includes("/rest/v1/rdv_invoices")) {
    insertedInvoices.push(JSON.parse(String(init?.body ?? "{}")));
    return Promise.resolve(new Response(JSON.stringify({}), { status: 201 }));
  }
  throw new Error(`URL non mockee: ${url}`);
}

beforeEach(() => {
  insertedInvoices = [];
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("demo-rdv-invoice — réservé aux comptes plan='demo', jamais Stripe", () => {
  it("compte plan='demo' -> facture paid/unlocked/is_demo, aucun appel Stripe", async () => {
    const req = reqWithAuth("broker-demo", { clientId: "client-of-demo", amountChf: 150 });
    const res = await handleDemoRdvInvoiceRequest(req, ENV);
    expect(res.status).toBe(200);
    expect(insertedInvoices[0]).toMatchObject({
      broker_id: "broker-demo",
      status: "paid",
      pdf_unlocked: true,
      is_demo: true,
    });
    expect(String(insertedInvoices[0].stripe_payment_intent_id)).toMatch(/^demo_pi_/);
  });

  it("compte de production (plan≠demo) -> refusé, même avec un JWT valide", async () => {
    const req = reqWithAuth("broker-prod", { amountChf: 150 });
    const res = await handleDemoRdvInvoiceRequest(req, ENV);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("réservée aux comptes en mode démo");
    expect(insertedInvoices).toHaveLength(0);
  });

  it("clientId d'un autre courtier -> refusé, pas de facture créée", async () => {
    const req = reqWithAuth("broker-demo", { clientId: "client-of-other", amountChf: 150 });
    const res = await handleDemoRdvInvoiceRequest(req, ENV);
    expect(res.status).toBe(500);
    expect(insertedInvoices).toHaveLength(0);
  });
});
