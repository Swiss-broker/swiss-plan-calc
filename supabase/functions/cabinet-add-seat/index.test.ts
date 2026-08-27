import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleCabinetAddSeatRequest, type Env } from "./index";

// Avant le correctif : `inviterId` ET `inviterEmail` venaient du body. Un
// attaquant connaissant l'id/email d'un directeur pouvait déclencher une
// facturation Stripe sur SON abonnement, ou rattacher un compte à un
// cabinet sans son consentement. Les deux doivent désormais être dérivés
// du JWT (avec repli sur le profil pour l'email si le JWT n'en porte pas).

const ENV: Env = {
  supabaseUrl: "https://fake.supabase.co",
  supabaseKey: "fake-key",
  stripeKey: "sk_test_fake",
  siteUrl: "https://swissbrokerpro.ch",
  brevoKey: "fake-brevo-key",
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
  return new Request("https://edge.local/cabinet-add-seat", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const profiles: Record<
  string,
  { plan: string; email: string; cabinet_role?: string; cabinet_root_id?: string }
> = {
  "director-A": { plan: "cabinet", email: "alice@cabinet-a.ch", cabinet_role: "director", cabinet_root_id: "cabinet-A" },
  "director-internal": { plan: "internal", email: "founder@swissbrokerpro.ch" },
  "director-noemail": { plan: "cabinet", email: "fallback@cabinet-a.ch", cabinet_role: "director", cabinet_root_id: "cabinet-A" },
  "director-B": { plan: "cabinet", email: "bob@cabinet-b.ch", cabinet_role: "director", cabinet_root_id: "cabinet-B" },
};

let stripeCustomerSearches: string[] = [];
let insertedInvites: unknown[] = [];
let brevoSent: { to: string }[] = [];

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";

  if (url.startsWith("https://api.brevo.com")) {
    const body = JSON.parse(String(init?.body ?? "{}"));
    brevoSent.push({ to: body.to?.[0]?.email });
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
  }

  if (url.includes("/rest/v1/profiles?id=eq.") && url.includes("select=plan,email,cabinet_role,cabinet_root_id")) {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    const p = profiles[id];
    return Promise.resolve(new Response(JSON.stringify(p ? [p] : []), { status: 200 }));
  }

  if (url.startsWith("https://api.stripe.com/v1/customers") && method === "GET") {
    const email = decodeURIComponent(url.match(/email=([^&]+)/)?.[1] ?? "");
    stripeCustomerSearches.push(email);
    return Promise.resolve(
      new Response(JSON.stringify({ data: [{ id: "cus_fake" }] }), { status: 200 }),
    );
  }
  if (url.startsWith("https://api.stripe.com/v1/subscriptions") && method === "GET") {
    return Promise.resolve(
      new Response(JSON.stringify({ data: [{ id: "sub_fake" }] }), { status: 200 }),
    );
  }
  if (url === "https://api.stripe.com/v1/subscription_items") {
    return Promise.resolve(new Response(JSON.stringify({ id: "si_fake" }), { status: 200 }));
  }

  if (url.includes("/rest/v1/profiles?email=eq.")) {
    return Promise.resolve(new Response(JSON.stringify([]), { status: 200 })); // pas de compte existant
  }

  if (url.includes("/rest/v1/cabinet_invites")) {
    const body = JSON.parse(String(init?.body ?? "{}"));
    insertedInvites.push(body);
    return Promise.resolve(
      new Response(JSON.stringify([{ id: "invite-new", ...body }]), { status: 201 }),
    );
  }

  throw new Error(`URL non mockee: ${method} ${url}`);
}

beforeEach(() => {
  stripeCustomerSearches = [];
  insertedInvites = [];
  brevoSent = [];
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("cabinet-add-seat — identité dérivée du JWT", () => {
  it("inviterId/inviterEmail falsifiés dans le body sont ignorés : le siège est facturé au VRAI appelant", async () => {
    const req = reqWithAuth("director-A", "alice@cabinet-a.ch", {
      inviterId: "director-internal", // tentative de se faire passer pour un compte interne (facturation évitée)
      inviterEmail: "victime@ailleurs.ch",
      cabinetRootId: "cabinet-A",
      inviteeEmail: "nouveau@client.ch",
      role: "courtier",
      payer: "cabinet",
    });
    const res = await handleCabinetAddSeatRequest(req, ENV);
    expect(res.status).toBe(200);
    // Le customer Stripe recherché est bien celui de l'appelant réel, pas
    // le faux email fourni dans le body.
    expect(stripeCustomerSearches).toContain("alice@cabinet-a.ch");
    expect(stripeCustomerSearches).not.toContain("victime@ailleurs.ch");
    expect(insertedInvites[0]).toMatchObject({ invited_by: "director-A" });
  });

  it("email absent du JWT -> repli sur l'email du profil, jamais sur le body", async () => {
    const req = reqWithAuth("director-noemail", undefined, {
      inviterEmail: "attaquant@ailleurs.ch",
      cabinetRootId: "cabinet-A",
      inviteeEmail: "nouveau@client.ch",
      role: "courtier",
      payer: "cabinet",
    });
    const res = await handleCabinetAddSeatRequest(req, ENV);
    expect(res.status).toBe(200);
    expect(stripeCustomerSearches).toContain("fallback@cabinet-a.ch");
    expect(stripeCustomerSearches).not.toContain("attaquant@ailleurs.ch");
  });

  it("compte interne : aucune facturation Stripe même si payer=cabinet", async () => {
    const req = reqWithAuth("director-internal", "founder@swissbrokerpro.ch", {
      cabinetRootId: "cabinet-A",
      inviteeEmail: "nouveau@client.ch",
      role: "courtier",
      payer: "cabinet",
    });
    const res = await handleCabinetAddSeatRequest(req, ENV);
    expect(res.status).toBe(200);
    expect(stripeCustomerSearches).toHaveLength(0);
    expect(insertedInvites[0]).toMatchObject({ stripe_subscription_item_id: null });
  });

  it("sans Authorization -> refus, aucune facturation déclenchée", async () => {
    const req = reqWithAuth(null, undefined, {
      cabinetRootId: "cabinet-A",
      inviteeEmail: "nouveau@client.ch",
      role: "courtier",
      payer: "cabinet",
    });
    const res = await handleCabinetAddSeatRequest(req, ENV);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("Authentification requise");
    expect(stripeCustomerSearches).toHaveLength(0);
    expect(insertedInvites).toHaveLength(0);
  });

  it("cabinetRootId d'un AUTRE cabinet -> refus, aucune invitation ni facturation", async () => {
    // director-B appartient à cabinet-B ; sans le contrôle d'autorité,
    // il pourrait injecter une invitation (et, si l'email cible existe déjà,
    // re-rattacher de force ce compte) dans cabinet-A.
    const req = reqWithAuth("director-B", "bob@cabinet-b.ch", {
      cabinetRootId: "cabinet-A",
      inviteeEmail: "nouveau@client.ch",
      role: "courtier",
      payer: "cabinet",
    });
    const res = await handleCabinetAddSeatRequest(req, ENV);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("autorité");
    expect(stripeCustomerSearches).toHaveLength(0);
    expect(insertedInvites).toHaveLength(0);
  });
});
