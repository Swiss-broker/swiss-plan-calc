import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleOpenOfferRequest, type Env } from "./index";

const ENV: Env = {
  supabaseUrl: "https://fake.supabase.co",
  supabaseKey: "fake-key",
  stripeKey: "sk_test_fake",
  cotisationPriceId: "price_cotisation_annuelle",
  siteUrl: "https://swissbrokerpro.ch",
};
const T_OK = "a".repeat(32);
const T_EXPIRED = "b".repeat(32);
const T_PAID = "c".repeat(32);
const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();
const offers: Record<string, Record<string, unknown>> = {
  [T_OK]: { id: "o1", demo_request_id: "lead-1", coupon_id: "coupon_x", created_by: "com-1", expires_at: future, open_count: 2 },
  [T_EXPIRED]: { id: "o2", demo_request_id: "lead-1", coupon_id: null, created_by: null, expires_at: past, open_count: 0 },
  [T_PAID]: { id: "o3", demo_request_id: "lead-2", coupon_id: null, created_by: null, expires_at: future, open_count: 0 },
};
const leads: Record<string, Record<string, unknown>> = {
  "lead-1": { id: "lead-1", email: "jean@x.ch", status: "contacted" },
  "lead-2": { id: "lead-2", email: "paye@x.ch", status: "converted" },
};
let sessionParams: URLSearchParams | null = null;
let patched: Record<string, unknown> | null = null;

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";
  if (url.includes("/rest/v1/lead_offers?token=eq.")) {
    const t = url.match(/token=eq\.([^&]+)/)?.[1] ?? "";
    return Promise.resolve(new Response(JSON.stringify(offers[t] ? [offers[t]] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/lead_offers?id=eq.") && method === "PATCH") {
    patched = JSON.parse(String(init?.body ?? "{}"));
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  if (url.includes("/rest/v1/demo_requests?id=eq.")) {
    const id = url.match(/id=eq\.([^&]+)/)?.[1] ?? "";
    return Promise.resolve(new Response(JSON.stringify(leads[id] ? [leads[id]] : []), { status: 200 }));
  }
  if (url === "https://api.stripe.com/v1/checkout/sessions") {
    sessionParams = new URLSearchParams(String(init?.body ?? ""));
    return Promise.resolve(new Response(JSON.stringify({ id: "cs_new", url: "https://checkout.stripe.com/new" }), { status: 200 }));
  }
  throw new Error(`URL non mockee: ${method} ${url}`);
}
const open = (token: unknown) =>
  handleOpenOfferRequest(
    new Request("https://edge.local/open-offer", { method: "POST", body: JSON.stringify({ token }) }),
    ENV,
  );

beforeEach(() => {
  sessionParams = null;
  patched = null;
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("open-offer — lien d'offre durable", () => {
  it("crée une page de paiement neuve avec le prix, le coupon et le lead de l'offre", async () => {
    const res = await open(T_OK);
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://checkout.stripe.com/new");
    expect(sessionParams?.get("line_items[0][price]")).toBe("price_cotisation_annuelle");
    expect(sessionParams?.get("discounts[0][coupon]")).toBe("coupon_x");
    expect(sessionParams?.get("metadata[demo_request_id]")).toBe("lead-1");
    expect(sessionParams?.get("customer_email")).toBe("jean@x.ch");
    expect(patched?.open_count).toBe(3);
  });
  it("offre expirée : refus, aucune page de paiement", async () => {
    const res = await open(T_EXPIRED);
    expect(res.status).toBe(410);
    expect((await res.json()).error).toBe("OFFER_EXPIRED");
    expect(sessionParams).toBeNull();
  });
  it("offre déjà payée : refus, aucune page de paiement", async () => {
    const res = await open(T_PAID);
    expect((await res.json()).error).toBe("OFFER_ALREADY_PAID");
    expect(sessionParams).toBeNull();
  });
  it("jeton invalide ou inconnu : introuvable", async () => {
    expect((await (await open("x&id=neq.0")).json()).error).toBe("OFFER_NOT_FOUND");
    expect((await (await open("d".repeat(32))).json()).error).toBe("OFFER_NOT_FOUND");
  });
});
