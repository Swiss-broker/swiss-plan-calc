import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleStripePortalRequest, type Env } from "./index";

// Avant le correctif : `brokerEmail` venait du body. N'importe quel
// utilisateur authentifié pouvait ouvrir le portail de facturation Stripe
// de n'importe quel email (et donc gérer l'abonnement d'un tiers).

const ENV: Env = { stripeKey: "sk_test_fake", siteUrl: "https://swissbrokerpro.ch" };

function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.fakesig`;
}

function reqWithAuth(email: string | null, body: Record<string, unknown>): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (email) headers.Authorization = `Bearer ${fakeJwt({ sub: "user-1", email })}`;
  return new Request("https://edge.local/stripe-portal", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

let searchedEmails: string[] = [];

function mockFetch(input: string | URL | Request): Promise<Response> {
  const url = String(input);
  if (url.startsWith("https://api.stripe.com/v1/customers")) {
    const email = decodeURIComponent(url.match(/email=([^&]+)/)?.[1] ?? "");
    searchedEmails.push(email);
    return Promise.resolve(
      new Response(JSON.stringify({ data: [{ id: "cus_fake" }] }), { status: 200 }),
    );
  }
  if (url === "https://api.stripe.com/v1/billing_portal/sessions") {
    return Promise.resolve(
      new Response(JSON.stringify({ url: "https://billing.stripe.com/session/fake" }), {
        status: 200,
      }),
    );
  }
  throw new Error(`URL non mockee: ${url}`);
}

beforeEach(() => {
  searchedEmails = [];
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("stripe-portal — identité dérivée du JWT", () => {
  it("brokerEmail falsifié dans le body est ignoré : seul l'email du JWT est utilisé", async () => {
    const req = reqWithAuth("moi@cabinet.ch", { brokerEmail: "victime@ailleurs.ch" });
    const res = await handleStripePortalRequest(req, ENV);
    expect(res.status).toBe(200);
    expect(searchedEmails).toEqual(["moi@cabinet.ch"]);
  });

  it("sans Authorization -> refus", async () => {
    const res = await handleStripePortalRequest(reqWithAuth(null, {}), ENV);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("Authentification requise");
    expect(searchedEmails).toHaveLength(0);
  });
});
