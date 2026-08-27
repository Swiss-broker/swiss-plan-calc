import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleStripeConnectOnboardRequest, type Env } from "./index";

// Avant le correctif : `brokerId`/`brokerEmail` venaient du body. N'importe
// quel utilisateur authentifié pouvait créer/piloter le compte Stripe
// Connect (coordonnées bancaires) d'un AUTRE courtier.

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

function reqWithAuth(
  userId: string | null,
  email: string | undefined,
  body: Record<string, unknown>,
): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (userId) headers.Authorization = `Bearer ${fakeJwt({ sub: userId, email })}`;
  return new Request("https://edge.local/stripe-connect-onboard", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

let existingAccounts: Record<string, { stripe_account_id: string; onboarding_complete: boolean }> =
  {};
let createdAccounts: { broker_id: string; email: string }[] = [];

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";

  if (url.includes("/rest/v1/broker_connect_accounts?broker_id=eq.") && method === "GET") {
    const id = decodeURIComponent(url.match(/broker_id=eq\.([^&]+)/)?.[1] ?? "");
    const acc = existingAccounts[id];
    return Promise.resolve(new Response(JSON.stringify(acc ? [acc] : []), { status: 200 }));
  }
  if (url === "https://api.stripe.com/v1/accounts") {
    const params = new URLSearchParams(String(init?.body ?? ""));
    createdAccounts.push({
      broker_id: params.get("metadata[broker_id]") ?? "",
      email: params.get("email") ?? "",
    });
    return Promise.resolve(new Response(JSON.stringify({ id: "acct_fake" }), { status: 200 }));
  }
  if (url.includes("/rest/v1/broker_connect_accounts") && method === "POST") {
    return Promise.resolve(new Response(JSON.stringify({}), { status: 201 }));
  }
  if (url === "https://api.stripe.com/v1/account_links") {
    return Promise.resolve(
      new Response(JSON.stringify({ url: "https://connect.stripe.com/onboard/fake" }), {
        status: 200,
      }),
    );
  }
  throw new Error(`URL non mockee: ${method} ${url}`);
}

beforeEach(() => {
  existingAccounts = {};
  createdAccounts = [];
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("stripe-connect-onboard — identité dérivée du JWT", () => {
  it("brokerId/brokerEmail falsifiés dans le body sont ignorés", async () => {
    const req = reqWithAuth("broker-A", "a@cabinet.ch", {
      brokerId: "broker-victime",
      brokerEmail: "victime@ailleurs.ch",
      returnUrl: "https://swissbrokerpro.ch/account",
    });
    const res = await handleStripeConnectOnboardRequest(req, ENV);
    expect(res.status).toBe(200);
    expect(createdAccounts).toEqual([{ broker_id: "broker-A", email: "a@cabinet.ch" }]);
  });

  it("compte Connect déjà existant pour l'appelant réel -> réutilisé, pas de nouveau compte créé pour la victime", async () => {
    existingAccounts["broker-A"] = {
      stripe_account_id: "acct_existing",
      onboarding_complete: false,
    };
    const req = reqWithAuth("broker-A", "a@cabinet.ch", {
      brokerId: "broker-victime",
      returnUrl: "https://swissbrokerpro.ch",
    });
    const res = await handleStripeConnectOnboardRequest(req, ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accountId).toBe("acct_existing");
    expect(createdAccounts).toHaveLength(0);
  });

  it("sans Authorization -> refus", async () => {
    const res = await handleStripeConnectOnboardRequest(reqWithAuth(null, undefined, {}), ENV);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("Authentification requise");
    expect(createdAccounts).toHaveLength(0);
  });
});
