import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleStripeCheckoutRequest, type Env } from "./index";

// Avant le correctif : `brokerId`/`brokerEmail` venaient du body. Même si
// le paiement réel reste protégé par Stripe, l'identité rattachée à la
// session (client_reference_id, metadata, email pré-rempli) doit refléter
// l'appelant réel, jamais une valeur qu'il choisit lui-même.

const ENV: Env = {
  stripeKey: "sk_test_fake",
  starterMonthly: "price_starter_m",
  proMonthly: "price_pro_m",
  cabinetMonthly: "price_cabinet_m",
  siteUrl: "https://swissbrokerpro.ch",
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
  return new Request("https://edge.local/stripe-checkout", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

let sessionParams: URLSearchParams | null = null;

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  if (url === "https://api.stripe.com/v1/checkout/sessions") {
    sessionParams = new URLSearchParams(String(init?.body ?? ""));
    return Promise.resolve(
      new Response(JSON.stringify({ url: "https://checkout.stripe.com/session/fake" }), {
        status: 200,
      }),
    );
  }
  throw new Error(`URL non mockee: ${url}`);
}

beforeEach(() => {
  sessionParams = null;
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("stripe-checkout — identité dérivée du JWT", () => {
  it("brokerId/brokerEmail falsifiés dans le body sont ignorés", async () => {
    const req = reqWithAuth("user-A", "moi@cabinet.ch", {
      priceId: "price_pro_m",
      brokerId: "user-victime",
      brokerEmail: "victime@ailleurs.ch",
    });
    const res = await handleStripeCheckoutRequest(req, ENV);
    expect(res.status).toBe(200);
    expect(sessionParams?.get("customer_email")).toBe("moi@cabinet.ch");
    expect(sessionParams?.get("client_reference_id")).toBe("user-A");
    expect(sessionParams?.get("metadata[broker_id]")).toBe("user-A");
  });

  it("le plan reste résolu côté serveur à partir du priceId, jamais du body", async () => {
    const req = reqWithAuth("user-A", "moi@cabinet.ch", { priceId: "price_cabinet_m" });
    const res = await handleStripeCheckoutRequest(req, ENV);
    expect(res.status).toBe(200);
    expect(sessionParams?.get("metadata[plan]")).toBe("cabinet");
  });

  it("priceId inconnu -> refus", async () => {
    const req = reqWithAuth("user-A", "moi@cabinet.ch", { priceId: "price_inconnu" });
    const res = await handleStripeCheckoutRequest(req, ENV);
    expect(res.status).toBe(500);
  });

  it("sans Authorization -> refus", async () => {
    const res = await handleStripeCheckoutRequest(
      reqWithAuth(null, undefined, { priceId: "price_pro_m" }),
      ENV,
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("Authentification requise");
  });
});
