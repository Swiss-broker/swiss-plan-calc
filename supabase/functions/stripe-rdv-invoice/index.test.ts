import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleStripeRdvInvoiceRequest, type Env } from "./index";

// Avant le correctif : `brokerId` venait du body (facturation sur le compte
// Connect d'un tiers), ET la requête client n'était jamais filtrée par
// broker_id (un attaquant pouvait faire fuiter le nom/date de
// naissance/genre/nationalité/email d'un client appartenant à un AUTRE
// courtier dans l'instantané de facture, en fournissant son clientId).

const ENV: Env = {
  supabaseUrl: "https://fake.supabase.co",
  supabaseKey: "fake-key",
  stripeKey: "sk_test_fake",
};

function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.fakesig`;
}

function reqWithAuth(userId: string | null, body: Record<string, unknown>): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (userId) headers.Authorization = `Bearer ${fakeJwt({ sub: userId })}`;
  return new Request("https://edge.local/stripe-rdv-invoice", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const connectAccounts: Record<string, { stripe_account_id: string; onboarding_complete: boolean }> =
  {
    "broker-A": { stripe_account_id: "acct_A", onboarding_complete: true },
  };

const clients: Record<string, { broker_id: string; first_name: string; email: string }> = {
  "client-of-A": { broker_id: "broker-A", first_name: "Jean", email: "jean@x.ch" },
  "client-of-B": { broker_id: "broker-B", first_name: "Secret", email: "secret@x.ch" },
};

let insertedInvoices: Record<string, unknown>[] = [];

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);

  if (url.includes("/rest/v1/broker_connect_accounts?broker_id=eq.")) {
    const id = decodeURIComponent(url.match(/broker_id=eq\.([^&]+)/)?.[1] ?? "");
    const acc = connectAccounts[id];
    return Promise.resolve(new Response(JSON.stringify(acc ? [acc] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/clients?id=eq.")) {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    const brokerFilter = decodeURIComponent(url.match(/broker_id=eq\.([^&]+)/)?.[1] ?? "");
    const c = clients[id];
    const match = c && c.broker_id === brokerFilter ? [c] : [];
    return Promise.resolve(new Response(JSON.stringify(match), { status: 200 }));
  }
  if (url === "https://api.stripe.com/v1/payment_intents") {
    return Promise.resolve(new Response(JSON.stringify({ id: "pi_fake" }), { status: 200 }));
  }
  if (url === "https://api.stripe.com/v1/prices") {
    return Promise.resolve(new Response(JSON.stringify({ id: "price_fake" }), { status: 200 }));
  }
  if (url === "https://api.stripe.com/v1/payment_links") {
    return Promise.resolve(
      new Response(JSON.stringify({ url: "https://buy.stripe.com/fake" }), { status: 200 }),
    );
  }
  if (url.includes("/rest/v1/rdv_invoices")) {
    const body = JSON.parse(String(init?.body ?? "{}"));
    insertedInvoices.push(body);
    return Promise.resolve(new Response(JSON.stringify({}), { status: 201 }));
  }
  throw new Error(`URL non mockee: ${url}`);
}

beforeEach(() => {
  insertedInvoices = [];
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("stripe-rdv-invoice — identité dérivée du JWT + isolation client", () => {
  it("brokerId falsifié dans le body est ignoré : facture émise sur le compte Connect de l'appelant réel", async () => {
    const req = reqWithAuth("broker-A", {
      brokerId: "broker-victime",
      clientId: "client-of-A",
      amountChf: 150,
    });
    const res = await handleStripeRdvInvoiceRequest(req, ENV);
    expect(res.status).toBe(200);
    expect(insertedInvoices[0]).toMatchObject({
      broker_id: "broker-A",
      snapshot_first_name: "Jean",
    });
  });

  it("un clientId appartenant à un AUTRE courtier est explicitement refusé (pas de fuite de PII, pas de facture créée)", async () => {
    const req = reqWithAuth("broker-A", { clientId: "client-of-B", amountChf: 150 });
    const res = await handleStripeRdvInvoiceRequest(req, ENV);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("n'existe pas ou ne vous appartient pas");
    expect(insertedInvoices).toHaveLength(0);
  });

  it("sans clientId (optionnel) -> facture créée sans instantané, comportement inchangé", async () => {
    const req = reqWithAuth("broker-A", { amountChf: 150 });
    const res = await handleStripeRdvInvoiceRequest(req, ENV);
    expect(res.status).toBe(200);
    expect(insertedInvoices[0]).toMatchObject({ snapshot_first_name: null, client_id: null });
  });

  it("sans Authorization -> refus", async () => {
    const res = await handleStripeRdvInvoiceRequest(reqWithAuth(null, { amountChf: 150 }), ENV);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("Authentification requise");
    expect(insertedInvoices).toHaveLength(0);
  });
});
