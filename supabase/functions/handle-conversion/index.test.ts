import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleConversionRequest, type Env } from "./index";

const ENV: Env = {
  supabaseUrl: "https://fake.supabase.co",
  supabaseKey: "fake-key",
  webhookSecret: "whsec_fake",
  siteUrl: "https://swissbrokerpro.ch",
};

async function signedRequest(event: Record<string, unknown>): Promise<Request> {
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(ENV.webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const signature = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return new Request("https://edge.local/handle-conversion", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": `t=${timestamp},v1=${signature}`,
    },
    body: payload,
  });
}

function checkoutEvent(demoRequestId: string | undefined): Record<string, unknown> {
  return {
    id: "evt_test",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test", metadata: { demo_request_id: demoRequestId } } },
  };
}

const leads: Record<string, { id: string; name: string; email: string; status: string }> = {
  "lead-1": { id: "lead-1", name: "Jean Dupont", email: "jean@x.ch", status: "pending" },
};
let patchedLeadStatus: string | null = null;
let insertedInvites: Array<Record<string, unknown>> = [];
let existingInvitesForLead: string[] = [];

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";

  if (url.includes("/rest/v1/demo_requests?id=eq.") && method === "GET") {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    const l = leads[id];
    return Promise.resolve(new Response(JSON.stringify(l ? [l] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/demo_requests?id=eq.") && method === "PATCH") {
    patchedLeadStatus = JSON.parse(String(init?.body ?? "{}")).status ?? null;
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  if (url.includes("/rest/v1/client_invites?demo_request_id=eq.")) {
    const id = decodeURIComponent(url.match(/demo_request_id=eq\.([^&]+)/)?.[1] ?? "");
    const already = existingInvitesForLead.includes(id);
    return Promise.resolve(
      new Response(JSON.stringify(already ? [{ id: "existing-invite" }] : []), { status: 200 }),
    );
  }
  if (url.includes("/rest/v1/client_invites") && method === "POST") {
    const body = JSON.parse(String(init?.body ?? "{}"));
    insertedInvites.push(body);
    return Promise.resolve(new Response(JSON.stringify([body]), { status: 201 }));
  }
  throw new Error(`URL non mockee: ${method} ${url}`);
}

beforeEach(() => {
  patchedLeadStatus = null;
  insertedInvites = [];
  existingInvitesForLead = [];
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("handle-conversion — cotisation annuelle (plus de sélection de plan)", () => {
  it("crée l'invitation avec le plan 'active', toujours, quel que soit ce que Stripe renvoie", async () => {
    const res = await handleConversionRequest(await signedRequest(checkoutEvent("lead-1")), ENV);
    expect(res.status).toBe(200);
    expect(insertedInvites).toHaveLength(1);
    expect(insertedInvites[0].plan).toBe("active");
    expect(insertedInvites[0].email).toBe("jean@x.ch");
    expect(patchedLeadStatus).toBe("converted");
  });

  it("idempotent : une invitation déjà créée pour ce lead n'est pas dupliquée", async () => {
    existingInvitesForLead = ["lead-1"];
    const res = await handleConversionRequest(await signedRequest(checkoutEvent("lead-1")), ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyProcessed).toBe(true);
    expect(insertedInvites).toHaveLength(0);
  });

  it("événement sans demo_request_id (pas un lead commercial) : ignoré", async () => {
    const res = await handleConversionRequest(await signedRequest(checkoutEvent(undefined)), ENV);
    expect(res.status).toBe(200);
    expect(insertedInvites).toHaveLength(0);
  });

  it("signature invalide -> refus", async () => {
    const req = new Request("https://edge.local/handle-conversion", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=bidon" },
      body: JSON.stringify(checkoutEvent("lead-1")),
    });
    const res = await handleConversionRequest(req, ENV);
    expect(res.status).toBe(401);
    expect(insertedInvites).toHaveLength(0);
  });
});
