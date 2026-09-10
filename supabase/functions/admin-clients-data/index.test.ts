import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleAdminClientsDataRequest, type Env } from "./index";

const ENV: Env = { supabaseUrl: "https://fake.supabase.co", supabaseKey: "fake-key" };

// UUID réalistes : la fonction filtre strictement brokerIds/clientIds sur
// UUID_RE pour counts_by_broker/by_broker/names_by_ids — des ids comme
// "broker-A" seraient silencieusement rejetés par ce garde-fou.
const BROKER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BROKER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CLIENT_1 = "11111111-1111-1111-1111-111111111111";
const CLIENT_2 = "22222222-2222-2222-2222-222222222222";

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
  [CLIENT_1]: { id: CLIENT_1, broker_id: BROKER_A, first_name: "Jean", last_name: "Dupont", email: "jean@x.ch", created_at: "2026-01-01", civil_status: "single" },
  [CLIENT_2]: { id: CLIENT_2, broker_id: BROKER_B, first_name: "Marie", last_name: "Rossi", email: "marie@x.ch", created_at: "2026-01-02", civil_status: "married" },
};

const profiles: Record<string, any> = {
  [BROKER_A]: { id: BROKER_A, first_name: "Karlyta", last_name: "K", email: "founder@swissbrokerpro.ch" },
  [BROKER_B]: { id: BROKER_B, first_name: "James", last_name: "P", email: "james@icloud.com" },
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
  if (url.includes("/rest/v1/clients?select=id") && method === "HEAD") {
    return Promise.resolve(new Response(null, { status: 200, headers: { "content-range": "*/2" } }));
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
    return Promise.resolve(new Response(JSON.stringify(pensionExists ? [{ client_id: CLIENT_1 }] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/client_pension") && (method === "PATCH" || method === "POST")) {
    pensionWrites.push({ method, body: JSON.parse(String(init?.body ?? "{}")) });
    return Promise.resolve(new Response("{}", { status: 201 }));
  }
  if (url.includes("/rest/v1/clients?broker_id=in.(")) {
    const ids = url.match(/broker_id=in\.\(([^)]+)\)/)?.[1]?.split(",") ?? [];
    const rows = Object.values(clients).filter((c: any) => ids.includes(c.broker_id)).map((c: any) => ({ broker_id: c.broker_id }));
    return Promise.resolve(new Response(JSON.stringify(rows), { status: 200 }));
  }
  if (url.includes("/rest/v1/clients?broker_id=eq.") && url.includes("select=id,first_name,last_name,email,created_at")) {
    const bId = decodeURIComponent(url.match(/broker_id=eq\.([^&]+)/)?.[1] ?? "");
    return Promise.resolve(new Response(JSON.stringify(Object.values(clients).filter((c: any) => c.broker_id === bId)), { status: 200 }));
  }
  if (url.includes("/rest/v1/clients?id=in.(")) {
    const ids = url.match(/id=in\.\(([^)]+)\)/)?.[1]?.split(",") ?? [];
    return Promise.resolve(new Response(JSON.stringify(ids.map((id) => clients[id]).filter(Boolean).map((c: any) => ({ id: c.id, first_name: c.first_name, last_name: c.last_name }))), { status: 200 }));
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
    expect(body.clients.find((c: any) => c.id === CLIENT_1).broker).toMatchObject({ first_name: "Karlyta" });
  });

  it("detail -> client + simulations + pension null (absente) + broker", async () => {
    const res = await handleAdminClientsDataRequest(reqWithAuth("caller-admin", { action: "detail", clientId: CLIENT_1 }), ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.client.id).toBe(CLIENT_1);
    expect(body.simulations).toHaveLength(1);
    expect(body.pension).toBeNull();
    expect(body.broker).toMatchObject({ first_name: "Karlyta" });
  });

  it("update -> PATCH clients avec la whitelist stricte, insert client_pension avec le bon broker_id", async () => {
    const res = await handleAdminClientsDataRequest(
      reqWithAuth("caller-admin", {
        action: "update",
        clientId: CLIENT_1,
        clientUpdate: { first_name: "Jean-Modifié", broker_id: "broker-ATTAQUANT" },
        pensionUpdate: { lpp_current_balance: 50000 },
      }),
      ENV,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(clientPatches[0]).toMatchObject({ first_name: "Jean-Modifié" });
    expect(clientPatches[0]).not.toHaveProperty("broker_id");
    expect(pensionWrites[0]).toMatchObject({ method: "POST", body: { client_id: CLIENT_1, broker_id: BROKER_A, lpp_current_balance: 50000 } });
  });

  it("count_all -> lit content-range en HEAD", async () => {
    const res = await handleAdminClientsDataRequest(reqWithAuth("caller-admin", { action: "count_all" }), ENV);
    expect(res.status).toBe(200);
    expect((await res.json()).count).toBe(2);
  });

  it("counts_by_broker -> une requête groupée, comptage correct par courtier", async () => {
    const res = await handleAdminClientsDataRequest(
      reqWithAuth("caller-admin", { action: "counts_by_broker", brokerIds: [BROKER_A, BROKER_B, "00000000-0000-0000-0000-000000000000"] }),
      ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.counts).toMatchObject({ [BROKER_A]: 1, [BROKER_B]: 1, "00000000-0000-0000-0000-000000000000": 0 });
  });

  it("counts_by_broker -> ignore les ids non-UUID (défense en profondeur)", async () => {
    const res = await handleAdminClientsDataRequest(
      reqWithAuth("caller-admin", { action: "counts_by_broker", brokerIds: [BROKER_A, "'; DROP TABLE clients; --"] }),
      ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body.counts)).toEqual([BROKER_A]);
  });

  it("by_broker -> liste les clients d'un seul courtier", async () => {
    const res = await handleAdminClientsDataRequest(reqWithAuth("caller-admin", { action: "by_broker", brokerId: BROKER_A }), ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clients).toHaveLength(1);
    expect(body.clients[0].id).toBe(CLIENT_1);
  });

  it("names_by_ids -> résout uniquement id/first_name/last_name", async () => {
    const res = await handleAdminClientsDataRequest(reqWithAuth("caller-admin", { action: "names_by_ids", clientIds: [CLIENT_1, CLIENT_2] }), ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clients).toHaveLength(2);
    expect(body.clients[0]).not.toHaveProperty("email");
  });
});
