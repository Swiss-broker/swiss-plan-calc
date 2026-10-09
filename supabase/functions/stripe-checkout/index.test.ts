import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleStripeCheckoutRequest, type Env } from "./index";

// Avant le correctif : `brokerId`/`brokerEmail` venaient du body. Même si
// le paiement réel reste protégé par Stripe, l'identité rattachée à la
// session (client_reference_id, metadata, email pré-rempli) doit refléter
// l'appelant réel, jamais une valeur qu'il choisit lui-même.

const ENV: Env = {
  stripeKey: "sk_test_fake",
  cotisationPriceId: "price_cotisation_annuelle",
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

describe("stripe-checkout — cotisation annuelle, identité dérivée du JWT", () => {
  it("brokerId/brokerEmail falsifiés dans le body sont ignorés", async () => {
    const req = reqWithAuth("user-A", "moi@cabinet.ch", {
      brokerId: "user-victime",
      brokerEmail: "victime@ailleurs.ch",
    });
    const res = await handleStripeCheckoutRequest(req, ENV);
    expect(res.status).toBe(200);
    expect(sessionParams?.get("customer_email")).toBe("moi@cabinet.ch");
    expect(sessionParams?.get("client_reference_id")).toBe("user-A");
    expect(sessionParams?.get("metadata[broker_id]")).toBe("user-A");
  });

  it("utilise toujours le seul prix configuré côté serveur (cotisation annuelle)", async () => {
    const req = reqWithAuth("user-A", "moi@cabinet.ch", {});
    const res = await handleStripeCheckoutRequest(req, ENV);
    expect(res.status).toBe(200);
    expect(sessionParams?.get("line_items[0][price]")).toBe("price_cotisation_annuelle");
    expect(sessionParams?.get("metadata[plan]")).toBe("active");
    expect(sessionParams?.get("subscription_data[metadata][plan]")).toBe("active");
  });

  it("un coupon fourni est transmis à Stripe", async () => {
    const req = reqWithAuth("user-A", "moi@cabinet.ch", { coupon: "PROMO10" });
    await handleStripeCheckoutRequest(req, ENV);
    expect(sessionParams?.get("discounts[0][coupon]")).toBe("PROMO10");
  });

  it("secret STRIPE_COTISATION_ANNUELLE manquant -> refus", async () => {
    const req = reqWithAuth("user-A", "moi@cabinet.ch", {});
    const res = await handleStripeCheckoutRequest(req, { ...ENV, cotisationPriceId: undefined });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("STRIPE_COTISATION_ANNUELLE");
  });

  it("sans Authorization -> refus", async () => {
    const res = await handleStripeCheckoutRequest(reqWithAuth(null, undefined, {}), ENV);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("Authentification requise");
  });
});
