import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleAdminSimulationsDataRequest, type Env } from "./index";

const ENV: Env = { supabaseUrl: "https://fake.supabase.co", supabaseKey: "fake-key" };

const BROKER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BROKER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.fakesig`;
}

function reqWithAuth(userId: string | null, body: Record<string, unknown>): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (userId) headers.Authorization = `Bearer ${fakeJwt({ sub: userId })}`;
  return new Request("https://edge.local/admin-simulations-data", { method: "POST", headers, body: JSON.stringify(body) });
}

const adminUsers: Record<string, { role: string }> = {
  "caller-admin": { role: "admin" },
  "caller-commercial": { role: "commercial" },
};

const sims = [
  { id: "sim-1", broker_id: BROKER_A, kind: "lpp", created_at: "2026-01-03" },
  { id: "sim-2", broker_id: BROKER_A, kind: "tax_global", created_at: "2026-01-01" },
  { id: "sim-3", broker_id: BROKER_B, kind: "divorce", created_at: "2026-01-02" },
];

function mockFetch(input: string | URL | Request): Promise<Response> {
  const url = String(input);

  if (url.includes("/rest/v1/admin_users?user_id=eq.") && url.includes("role=eq.admin")) {
    const id = decodeURIComponent(url.match(/user_id=eq\.([^&]+)/)?.[1] ?? "");
    const a = adminUsers[id];
    return Promise.resolve(new Response(JSON.stringify(a?.role === "admin" ? [{ user_id: id }] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/simulation_history?broker_id=eq.")) {
    const id = decodeURIComponent(url.match(/broker_id=eq\.([^&]+)/)?.[1] ?? "");
    return Promise.resolve(new Response(JSON.stringify(sims.filter((s) => s.broker_id === id)), { status: 200 }));
  }
  throw new Error(`URL non mockee: ${url}`);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("admin-simulations-data", () => {
  it("appelant non-admin -> refusé", async () => {
    const res = await handleAdminSimulationsDataRequest(reqWithAuth("caller-commercial", { action: "by_broker", brokerId: BROKER_A }), ENV);
    expect(res.status).toBe(500);
    expect(String((await res.json()).error)).toContain("Réservé aux administrateurs");
  });

  it("by_broker -> ne renvoie que les simulations de ce courtier", async () => {
    const res = await handleAdminSimulationsDataRequest(reqWithAuth("caller-admin", { action: "by_broker", brokerId: BROKER_A }), ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.simulations).toHaveLength(2);
    expect(body.simulations.every((s: any) => s.broker_id === BROKER_A)).toBe(true);
  });

  it("by_broker -> brokerId invalide (non-UUID) refusé", async () => {
    const res = await handleAdminSimulationsDataRequest(reqWithAuth("caller-admin", { action: "by_broker", brokerId: "'; DROP TABLE simulation_history; --" }), ENV);
    expect(res.status).toBe(500);
    expect(String((await res.json()).error)).toContain("invalide");
  });

  it("action inconnue -> refusée", async () => {
    const res = await handleAdminSimulationsDataRequest(reqWithAuth("caller-admin", { action: "bogus" }), ENV);
    expect(res.status).toBe(500);
    expect(String((await res.json()).error)).toContain("Action inconnue");
  });
});
