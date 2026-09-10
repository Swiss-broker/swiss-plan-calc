import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleAdminInviteCommercialRequest, type Env } from "./index";

const ENV: Env = { supabaseUrl: "https://fake.supabase.co", supabaseKey: "fake-key", brevoKey: "fake-brevo" };

function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.fakesig`;
}

function reqWithAuth(userId: string | null, body: Record<string, unknown>): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (userId) headers.Authorization = `Bearer ${fakeJwt({ sub: userId })}`;
  return new Request("https://edge.local/admin-invite-commercial", { method: "POST", headers, body: JSON.stringify(body) });
}

const adminUsers: Record<string, { role: string }> = {
  "caller-admin": { role: "admin" },
  "caller-commercial": { role: "commercial" },
};

// profiles indexées par email (chemin "compte existant")
const profilesByEmail: Record<string, { id: string; plan: string }> = {
  "existing.commercial@swissbrokerpro.ch": { id: "user-existing", plan: "trial" },
  "founder@swissbrokerpro.ch": { id: "user-founder", plan: "internal" },
  "otheradmin@swissbrokerpro.ch": { id: "user-otheradmin", plan: "demo" },
};
// admin_users indexées par user_id (pour le check existingAdmin)
const adminUsersByUserId: Record<string, { role: string }> = {
  "user-otheradmin": { role: "admin" },
};

let writes: { url: string; method: string; body: unknown }[] = [];
let brevoSent: unknown[] = [];

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";

  if (url.includes("/rest/v1/admin_users?user_id=eq.") && url.includes("role=eq.admin")) {
    const id = decodeURIComponent(url.match(/user_id=eq\.([^&]+)/)?.[1] ?? "");
    const a = adminUsers[id];
    const match = a && a.role === "admin" ? [{ user_id: id }] : [];
    return Promise.resolve(new Response(JSON.stringify(match), { status: 200 }));
  }
  if (url.includes("/rest/v1/admin_users?user_id=eq.") && method === "GET") {
    const id = decodeURIComponent(url.match(/user_id=eq\.([^&]+)/)?.[1] ?? "");
    const a = adminUsersByUserId[id];
    return Promise.resolve(new Response(JSON.stringify(a ? [{ user_id: id, role: a.role }] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/profiles?email=eq.")) {
    const email = decodeURIComponent(url.match(/email=eq\.([^&]+)/)?.[1] ?? "");
    const p = profilesByEmail[email];
    return Promise.resolve(new Response(JSON.stringify(p ? [p] : []), { status: 200 }));
  }
  if (url.includes("/auth/v1/admin/generate_link")) {
    return Promise.resolve(
      new Response(
        JSON.stringify({ user: { id: "user-new" }, properties: { action_link: "https://fake.supabase.co/auth/v1/verify?token=abc" } }),
        { status: 200 },
      ),
    );
  }
  if (url.includes("/rest/v1/admin_users") || url.includes("/rest/v1/profiles?id=eq.")) {
    writes.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    return Promise.resolve(new Response(JSON.stringify({}), { status: 201 }));
  }
  if (url.includes("api.brevo.com")) {
    brevoSent.push(init?.body ? JSON.parse(String(init.body)) : null);
    return Promise.resolve(new Response("{}", { status: 200 }));
  }
  throw new Error(`URL non mockee: ${url} (${method})`);
}

beforeEach(() => {
  writes = [];
  brevoSent = [];
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("admin-invite-commercial", () => {
  it("appelant non-admin -> refusé, rien écrit", async () => {
    const req = reqWithAuth("caller-commercial", { email: "new@swissbrokerpro.ch", displayName: "Jean Dupont" });
    const res = await handleAdminInviteCommercialRequest(req, ENV);
    expect(res.status).toBe(500);
    expect(String((await res.json()).error)).toContain("Réservé aux administrateurs");
    expect(writes).toHaveLength(0);
  });

  it("email hors @swissbrokerpro.ch -> refusé", async () => {
    const req = reqWithAuth("caller-admin", { email: "perso@gmail.com", displayName: "Jean Dupont" });
    const res = await handleAdminInviteCommercialRequest(req, ENV);
    expect(res.status).toBe(500);
    expect(String((await res.json()).error)).toContain("@swissbrokerpro.ch");
  });

  it("email inconnu -> génère un lien d'invitation, admin_users+profiles écrits, email Brevo envoyé", async () => {
    const req = reqWithAuth("caller-admin", { email: "new@swissbrokerpro.ch", displayName: "Jean Dupont" });
    const res = await handleAdminInviteCommercialRequest(req, ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, mode: "invited", userId: "user-new" });
    expect(writes.some(w => w.url.includes("/admin_users") && (w.body as any).role === "commercial")).toBe(true);
    expect(writes.some(w => w.url.includes("/profiles?id=eq.user-new") && (w.body as any).plan === "demo")).toBe(true);
    expect(brevoSent).toHaveLength(1);
  });

  it("email déjà existant (pas encore admin_users) -> rattachement silencieux, pas d'email envoyé", async () => {
    const req = reqWithAuth("caller-admin", { email: "existing.commercial@swissbrokerpro.ch", displayName: "Jean Dupont" });
    const res = await handleAdminInviteCommercialRequest(req, ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, mode: "reattached", userId: "user-existing" });
    expect(writes.some(w => w.url.includes("/profiles?id=eq.user-existing") && (w.body as any).plan === "demo")).toBe(true);
    expect(brevoSent).toHaveLength(0);
  });

  it("compte déjà 'internal' -> refusé, rien écrit", async () => {
    const req = reqWithAuth("caller-admin", { email: "founder@swissbrokerpro.ch", displayName: "Karlyta" });
    const res = await handleAdminInviteCommercialRequest(req, ENV);
    expect(res.status).toBe(500);
    expect(String((await res.json()).error)).toContain("accès interne");
    expect(writes).toHaveLength(0);
  });

  it("compte déjà admin -> refusé (jamais rétrogradé), rien écrit", async () => {
    const req = reqWithAuth("caller-admin", { email: "otheradmin@swissbrokerpro.ch", displayName: "Autre Admin" });
    const res = await handleAdminInviteCommercialRequest(req, ENV);
    expect(res.status).toBe(500);
    expect(String((await res.json()).error)).toContain("déjà administrateur");
    expect(writes).toHaveLength(0);
  });
});
