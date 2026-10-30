import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleAdminConvertLeadRequest, type Env } from "./index";

const ENV: Env = {
  supabaseUrl: "https://fake.supabase.co",
  supabaseKey: "fake-key",
  siteUrl: "https://swissbrokerpro.ch",
  brevoKey: "brevo-fake",
};

function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.fakesig`;
}

function reqWithAuth(userId: string | null, body: Record<string, unknown>): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (userId) headers.Authorization = `Bearer ${fakeJwt({ sub: userId })}`;
  return new Request("https://edge.local/admin-convert-lead", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const staff: Record<string, { role: string }> = {
  "admin-1": { role: "admin" },
  "commercial-1": { role: "commercial" },
};
type LeadFixture = { id: string; name: string; email: string | null; status: string; assigned_to: string | null };
function freshLeads(): Record<string, LeadFixture> {
  return {
    "lead-1": { id: "lead-1", name: "Jocelyn Jocelyn", email: "jocelyn@howhen.fr", status: "converted", assigned_to: "commercial-1" },
    "lead-2": { id: "lead-2", name: "Autre Lead", email: "autre@x.ch", status: "contacted", assigned_to: "commercial-1" },
    "lead-3": { id: "lead-3", name: "Lead d'un autre commercial", email: "tiers@x.ch", status: "contacted", assigned_to: "commercial-2" },
    "lead-no-email": { id: "lead-no-email", name: "Sans Email", email: null, status: "contacted", assigned_to: "commercial-1" },
  };
}
let leads: Record<string, LeadFixture> = freshLeads();

let patchedStatus: Record<string, string> = {};
let insertedInvites: Array<Record<string, unknown>> = [];
let existingInvitesFor: string[] = [];
let sentEmails: Array<{ to: string; subject: string }> = [];

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";

  if (url.includes("/rest/v1/admin_users?user_id=eq.")) {
    const id = decodeURIComponent(url.match(/user_id=eq\.([^&]+)/)?.[1] ?? "");
    const s = staff[id];
    return Promise.resolve(new Response(JSON.stringify(s ? [s] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/demo_requests?id=eq.") && method === "GET") {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    const l = leads[id];
    return Promise.resolve(new Response(JSON.stringify(l ? [l] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/demo_requests?id=eq.") && method === "PATCH") {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    patchedStatus[id] = JSON.parse(String(init?.body ?? "{}")).status ?? "";
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  if (url.includes("/rest/v1/client_invites?demo_request_id=eq.")) {
    const id = decodeURIComponent(url.match(/demo_request_id=eq\.([^&]+)/)?.[1] ?? "");
    const already = existingInvitesFor.includes(id);
    return Promise.resolve(
      new Response(JSON.stringify(already ? [{ id: "existing-invite" }] : []), { status: 200 }),
    );
  }
  if (url.includes("/rest/v1/client_invites") && method === "POST") {
    const body = JSON.parse(String(init?.body ?? "{}"));
    insertedInvites.push(body);
    return Promise.resolve(new Response(JSON.stringify([body]), { status: 201 }));
  }
  if (url === "https://api.brevo.com/v3/smtp/email") {
    const body = JSON.parse(String(init?.body ?? "{}"));
    sentEmails.push({ to: body.to?.[0]?.email, subject: body.subject });
    return Promise.resolve(new Response(JSON.stringify({ messageId: "fake" }), { status: 201 }));
  }
  throw new Error(`URL non mockee: ${method} ${url}`);
}

beforeEach(() => {
  leads = freshLeads();
  patchedStatus = {};
  insertedInvites = [];
  existingInvitesFor = [];
  sentEmails = [];
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("admin-convert-lead — conversion manuelle hors paiement en ligne", () => {
  it("crée une invitation d'onboarding et envoie l'e-mail, comme le ferait le webhook Stripe", async () => {
    const req = reqWithAuth("commercial-1", { demo_request_id: "lead-2" });
    const res = await handleAdminConvertLeadRequest(req, ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.converted).toBe(true);
    expect(body.alreadyInvited).toBe(false);
    expect(insertedInvites).toHaveLength(1);
    expect(insertedInvites[0].plan).toBe("active");
    expect(insertedInvites[0].email).toBe("autre@x.ch");
    expect(patchedStatus["lead-2"]).toBe("converted");
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe("autre@x.ch");
  });

  it("idempotent : n'envoie pas une deuxième invitation si une existe déjà (ex. converti entre-temps par Stripe)", async () => {
    existingInvitesFor = ["lead-1"];
    const req = reqWithAuth("commercial-1", { demo_request_id: "lead-1" });
    const res = await handleAdminConvertLeadRequest(req, ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyInvited).toBe(true);
    expect(insertedInvites).toHaveLength(0);
    expect(sentEmails).toHaveLength(0);
    // lead-1 était déjà "converted" : pas de PATCH redondant.
    expect(patchedStatus["lead-1"]).toBeUndefined();
  });

  it("un commercial ne peut convertir que ses propres leads assignés", async () => {
    const req = reqWithAuth("commercial-1", { demo_request_id: "lead-3" });
    const res = await handleAdminConvertLeadRequest(req, ENV);
    expect(res.status).toBe(403);
    expect(insertedInvites).toHaveLength(0);
  });

  it("un admin peut convertir n'importe quel lead", async () => {
    const req = reqWithAuth("admin-1", { demo_request_id: "lead-3" });
    const res = await handleAdminConvertLeadRequest(req, ENV);
    expect(res.status).toBe(200);
    expect(insertedInvites).toHaveLength(1);
  });

  it("refusé pour un appelant qui n'est ni admin ni commercial", async () => {
    const req = reqWithAuth("inconnu-1", { demo_request_id: "lead-2" });
    const res = await handleAdminConvertLeadRequest(req, ENV);
    expect(res.status).toBe(403);
  });

  it("lead sans e-mail : refusé avant toute tentative d'invitation", async () => {
    const req = reqWithAuth("commercial-1", { demo_request_id: "lead-no-email" });
    const res = await handleAdminConvertLeadRequest(req, ENV);
    expect(res.status).toBe(400);
    expect(insertedInvites).toHaveLength(0);
  });

  it("demo_request_id manquant -> refus", async () => {
    const req = reqWithAuth("commercial-1", {});
    const res = await handleAdminConvertLeadRequest(req, ENV);
    expect(res.status).toBe(400);
  });
});
