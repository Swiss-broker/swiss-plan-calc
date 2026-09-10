import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleAdminClientsDataRequest, type Env } from "./index";

const ENV: Env = { supabaseUrl: "https://fake.supabase.co", supabaseKey: "fake-key" };

function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.fakesig`;
}

function reqWithAuth(userId: string | null, body: Record<string, unknown>): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (userId) headers.Authorization = `Bearer ${fakeJwt({ sub: userId })}`;
  return new Request("https://edge.local/admin-clients-data", { method: "POST", headers, body: JSON.stringify(body) });
}

const adminUsers: Record<string, { role: string }> = {
  "caller-admin": { role: "admin" },
  "caller-commercial": { role: "commercial" },
};

const clients: Record<string, any> = {
  "client-1": { id: "client-1", broker_id: "broker-A", first_name: "Jean", last_name: "Dupont", email: "jean@x.ch", created_at: "2026-01-01", civil_status: "single" },
  "client-2": { id: "client-2", broker_id: "broker-B", first_name: "Marie", last_name: "Rossi", email: "marie@x.ch", created_at: "2026-01-02", civil_status: "married" },
};

const profiles: Record<string, any> = {
  "broker-A": { id: "broker-A", first_name: "Karlyta", last_name: "K", email: "founder@swissbrokerpro.ch" },
  "broker-B": { id: "broker-B", first_name: "James", last_name: "P", email: "james@icloud.com" },
};

let clientPatches: Record<string, unknown>[] = [];
let pensionWrites: { method: string; body: unknown }[] = [];
let pensionExists = false;

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";

  if (url.includes("/rest/v1/admin_users?user_id=eq.") && url.includes("role=eq.admin")) {
    const id = decodeURIComponent(url.match(/user_id=eq\.([^&]+)/)?.[1] ?? "");
    const a = adminUsers[id];
    return Promise.resolve(new Response(JSON.stringify(a?.role === "admin" ? [{ user_id: id }] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/clients?select=id,first_name")) {
    return Promise.resolve(new Response(JSON.stringify(Object.values(clients)), { status: 200 }));
  }
  if (url.includes("/rest/v1/profiles?id=in.(")) {
    const ids = url.match(/id=in\.\(([^)]+)\)/)?.[1]?.split(",") ?? [];
    return Promise.resolve(new Response(JSON.stringify(ids.map((id) => profiles[id]).filter(Boolean)), { status: 200 }));
  }
  if (url.includes("/rest/v1/clients?id=eq.") && url.includes("select=*")) {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    return Promise.resolve(new Response(JSON.stringify(clients[id] ? [clients[id]] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/simulation_history?client_id=eq.")) {
    return Promise.resolve(new Response(JSON.stringify([{ id: "sim-1", kind: "lpp", created_at: "2026-01-03" }]), { status: 200 }));
  }
  if (url.includes("/rest/v1/client_pension?client_id=eq.") && url.includes("select=lpp_current_balance")) {
    return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
  }
  if (url.includes("/rest/v1/profiles?id=eq.") && url.includes("select=first_name,last_name")) {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    return Promise.resolve(new Response(JSON.stringify(profiles[id] ? [profiles[id]] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/clients?id=eq.") && url.includes("select=broker_id")) {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    return Promise.resolve(new Response(JSON.stringify(clients[id] ? [{ broker_id: clients[id].broker_id }] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/clients?id=eq.") && method === "PATCH") {
    clientPatches.push(JSON.parse(String(init?.body ?? "{}")));
    // 204 = pas de corps (Prefer: return=minimal, comportement PostgREST réel).
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  if (url.includes("/rest/v1/client_pension?client_id=eq.") && url.includes("select=client_id")) {
    return Promise.resolve(new Response(JSON.stringify(pensionExists ? [{ client_id: "client-1" }] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/client_pension") && (method === "PATCH" || method === "POST")) {
    pensionWrites.push({ method, body: JSON.parse(String(init?.body ?? "{}")) });
    return Promise.resolve(new Response("{}", { status: 201 }));
  }
  throw new Error(`URL non mockee: ${url} (${method})`);
}

beforeEach(() => {
  clientPatches = [];
  pensionWrites = [];
  pensionExists = false;
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("admin-clients-data", () => {
  it("appelant non-admin -> refusé", async () => {
    const res = await handleAdminClientsDataRequest(reqWithAuth("caller-commercial", { action: "list" }), ENV);
    expect(res.status).toBe(500);
    expect(String((await res.json()).error)).toContain("Réservé aux administrateurs");
  });

  it("list -> combine clients + courtier (broker), tous courtiers confondus", async () => {
    const res = await handleAdminClientsDataRequest(reqWithAuth("caller-admin", { action: "list" }), ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clients).toHaveLength(2);
    expect(body.clients.find((c: any) => c.id === "client-1").broker).toMatchObject({ first_name: "Karlyta" });
  });

  it("detail -> client + simulations + pension null (absente) + broker", async () => {
    const res = await handleAdminClientsDataRequest(reqWithAuth("caller-admin", { action: "detail", clientId: "client-1" }), ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.client.id).toBe("client-1");
    expect(body.simulations).toHaveLength(1);
    expect(body.pension).toBeNull();
    expect(body.broker).toMatchObject({ first_name: "Karlyta" });
  });

  it("update -> PATCH clients avec la whitelist stricte, insert client_pension avec le bon broker_id", async () => {
    const res = await handleAdminClientsDataRequest(
      reqWithAuth("caller-admin", {
        action: "update",
        clientId: "client-1",
        clientUpdate: { first_name: "Jean-Modifié", broker_id: "broker-ATTAQUANT" },
        pensionUpdate: { lpp_current_balance: 50000 },
      }),
      ENV,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(clientPatches[0]).toMatchObject({ first_name: "Jean-Modifié" });
    expect(clientPatches[0]).not.toHaveProperty("broker_id");
    expect(pensionWrites[0]).toMatchObject({ method: "POST", body: { client_id: "client-1", broker_id: "broker-A", lpp_current_balance: 50000 } });
  });
});
