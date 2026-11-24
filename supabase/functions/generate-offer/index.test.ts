import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleGenerateOfferRequest, type Env } from "./index";

const ENV: Env = {
  supabaseUrl: "https://fake.supabase.co",
  supabaseKey: "fake-key",
  stripeKey: "sk_test_fake",
  cotisationPriceId: "price_cotisation_annuelle",
  siteUrl: "https://swissbrokerpro.ch",
};

function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.fakesig`;
}

function reqWithAuth(userId: string | null, body: Record<string, unknown>): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (userId) headers.Authorization = `Bearer ${fakeJwt({ sub: userId })}`;
  return new Request("https://edge.local/generate-offer", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const staff: Record<string, { role: string }> = {
  "admin-1": { role: "admin" },
  "commercial-1": { role: "commercial" },
};
const leads: Record<
  string,
  { id: string; name: string; email: string; assigned_to: string | null }
> = {
  "lead-1": { id: "lead-1", name: "Jean Dupont", email: "jean@x.ch", assigned_to: "commercial-1" },
  "lead-2": { id: "lead-2", name: "Autre Lead", email: "autre@x.ch", assigned_to: "commercial-2" },
};

let sessionParams: URLSearchParams | null = null;
let couponParams: URLSearchParams | null = null;
let loggedAction: Record<string, unknown> | null = null;

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";

  if (url.includes("/rest/v1/admin_users?user_id=eq.")) {
    const id = decodeURIComponent(url.match(/user_id=eq\.([^&]+)/)?.[1] ?? "");
    const s = staff[id];
    return Promise.resolve(new Response(JSON.stringify(s ? [s] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/demo_requests?id=eq.")) {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    const l = leads[id];
    return Promise.resolve(new Response(JSON.stringify(l ? [l] : []), { status: 200 }));
  }
  if (url === "https://api.stripe.com/v1/coupons") {
    couponParams = new URLSearchParams(String(init?.body ?? ""));
    return Promise.resolve(new Response(JSON.stringify({ id: "coupon_fake" }), { status: 200 }));
  }
  if (url === "https://api.stripe.com/v1/checkout/sessions") {
    sessionParams = new URLSearchParams(String(init?.body ?? ""));
    return Promise.resolve(
      new Response(
        JSON.stringify({ id: "cs_fake", url: "https://checkout.stripe.com/session/fake" }),
        { status: 200 },
      ),
    );
  }
  if (url.includes("/rest/v1/admin_actions") && method === "POST") {
    loggedAction = JSON.parse(String(init?.body ?? "{}"));
    return Promise.resolve(new Response(null, { status: 201 }));
  }
  throw new Error(`URL non mockee: ${method} ${url}`);
}

beforeEach(() => {
  sessionParams = null;
  couponParams = null;
  loggedAction = null;
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("generate-offer — cotisation annuelle (plus de choix de plan/période)", () => {
  it("génère une session Checkout pour le seul prix configuré, sans sélection de plan", async () => {
    const req = reqWithAuth("commercial-1", {
      demo_request_id: "lead-1",
      discount_duration: "none",
    });
    const res = await handleGenerateOfferRequest(req, ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://checkout.stripe.com/session/fake");
    expect(sessionParams?.get("line_items[0][price]")).toBe("price_cotisation_annuelle");
    expect(sessionParams?.get("metadata[plan]")).toBeNull();
  });

  it("un commercial ne peut générer une offre que pour un lead qui lui est assigné", async () => {
    const req = reqWithAuth("commercial-1", {
      demo_request_id: "lead-2",
      discount_duration: "none",
    });
    const res = await handleGenerateOfferRequest(req, ENV);
    expect(res.status).toBe(403);
  });

  it("un admin peut générer une offre pour n'importe quel lead", async () => {
    const req = reqWithAuth("admin-1", { demo_request_id: "lead-2", discount_duration: "none" });
    const res = await handleGenerateOfferRequest(req, ENV);
    expect(res.status).toBe(200);
  });

  it("refusé pour un appelant qui n'est ni admin ni commercial", async () => {
    const req = reqWithAuth("inconnu", { demo_request_id: "lead-1", discount_duration: "none" });
    const res = await handleGenerateOfferRequest(req, ENV);
    expect(res.status).toBe(403);
  });

  it("secret STRIPE_COTISATION_ANNUELLE manquant -> refus avant tout appel Stripe", async () => {
    const req = reqWithAuth("commercial-1", {
      demo_request_id: "lead-1",
      discount_duration: "none",
    });
    const res = await handleGenerateOfferRequest(req, { ...ENV, cotisationPriceId: undefined });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("STRIPE_COTISATION_ANNUELLE");
  });

  it("remise : crée un coupon Stripe et l'applique à la session", async () => {
    const req = reqWithAuth("commercial-1", {
      demo_request_id: "lead-1",
      discount_duration: "2_years",
      discount_percent: 20,
    });
    const res = await handleGenerateOfferRequest(req, ENV);
    expect(res.status).toBe(200);
    expect(couponParams?.get("percent_off")).toBe("20");
    expect(couponParams?.get("duration")).toBe("repeating");
    expect(couponParams?.get("duration_in_months")).toBe("24");
    expect(sessionParams?.get("discounts[0][coupon]")).toBe("coupon_fake");
  });

  it("journalise l'offre dans admin_actions sans référence à un plan ou une période", async () => {
    const req = reqWithAuth("commercial-1", {
      demo_request_id: "lead-1",
      discount_duration: "none",
    });
    await handleGenerateOfferRequest(req, ENV);
    expect(loggedAction?.action).toBe("generate_offer");
    expect((loggedAction?.details as Record<string, unknown>)?.plan).toBeUndefined();
  });
});
