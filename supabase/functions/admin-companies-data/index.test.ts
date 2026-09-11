import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleAdminCompaniesDataRequest, type Env } from "./index";

const ENV: Env = { supabaseUrl: "https://fake.supabase.co", supabaseKey: "fake-key" };

function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.fakesig`;
}

function reqWithAuth(userId: string | null, body: Record<string, unknown>): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (userId) headers.Authorization = `Bearer ${fakeJwt({ sub: userId })}`;
  return new Request("https://edge.local/admin-companies-data", { method: "POST", headers, body: JSON.stringify(body) });
}

const adminUsers: Record<string, { role: string }> = {
  "caller-admin": { role: "admin" },
  "caller-commercial": { role: "commercial" },
};

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";

  if (url.includes("/rest/v1/admin_users?user_id=eq.") && url.includes("role=eq.admin")) {
    const id = decodeURIComponent(url.match(/user_id=eq\.([^&]+)/)?.[1] ?? "");
    const a = adminUsers[id];
    return Promise.resolve(new Response(JSON.stringify(a?.role === "admin" ? [{ user_id: id }] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/companies?select=id") && method === "HEAD") {
    return Promise.resolve(new Response(null, { status: 200, headers: { "content-range": "*/7" } }));
  }
  throw new Error(`URL non mockee: ${url} (${method})`);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("admin-companies-data", () => {
  it("appelant non-admin -> refusé", async () => {
    const res = await handleAdminCompaniesDataRequest(reqWithAuth("caller-commercial", { action: "count_all" }), ENV);
    expect(res.status).toBe(500);
    expect(String((await res.json()).error)).toContain("Réservé aux administrateurs");
  });

  it("count_all -> lit content-range en HEAD", async () => {
    const res = await handleAdminCompaniesDataRequest(reqWithAuth("caller-admin", { action: "count_all" }), ENV);
    expect(res.status).toBe(200);
    expect((await res.json()).count).toBe(7);
  });

  it("action inconnue -> refusée", async () => {
    const res = await handleAdminCompaniesDataRequest(reqWithAuth("caller-admin", { action: "bogus" }), ENV);
    expect(res.status).toBe(500);
    expect(String((await res.json()).error)).toContain("Action inconnue");
  });
});
