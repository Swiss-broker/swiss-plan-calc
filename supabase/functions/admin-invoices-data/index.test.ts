import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleAdminInvoicesDataRequest, type Env } from "./index";

const ENV: Env = { supabaseUrl: "https://fake.supabase.co", supabaseKey: "fake-key" };

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
  return new Request("https://edge.local/admin-invoices-data", { method: "POST", headers, body: JSON.stringify(body) });
}

const adminUsers: Record<string, { role: string }> = {
  "caller-admin": { role: "admin" },
  "caller-commercial": { role: "commercial" },
};

// inv-1 : payée, non-demo, courtier A, janvier 2026
// inv-2 : en attente, non-demo, courtier B -> jamais comptée dans les sommes "paid"
// inv-3 : payée mais is_demo=true, courtier A -> exclue de tout (list_all et les sommes filtrent is_demo=false)
// inv-4 : payée, non-demo, courtier A, décembre 2025 -> hors fenêtre "depuis janvier" pour sum_paid_by_broker
const invoices = [
  { id: "inv-1", created_at: "2026-01-10T00:00:00.000Z", amount_chf: 10000, status: "paid", client_id: CLIENT_1, broker_id: BROKER_A, is_demo: false },
  { id: "inv-2", created_at: "2026-01-11T00:00:00.000Z", amount_chf: 5000, status: "pending", client_id: CLIENT_2, broker_id: BROKER_B, is_demo: false },
  { id: "inv-3", created_at: "2026-01-12T00:00:00.000Z", amount_chf: 99999, status: "paid", client_id: CLIENT_1, broker_id: BROKER_A, is_demo: true },
  { id: "inv-4", created_at: "2025-12-15T00:00:00.000Z", amount_chf: 7000, status: "paid", client_id: CLIENT_1, broker_id: BROKER_A, is_demo: false },
];

function mockFetch(input: string | URL | Request): Promise<Response> {
  const url = String(input);

  if (url.includes("/rest/v1/admin_users?user_id=eq.") && url.includes("role=eq.admin")) {
    const id = decodeURIComponent(url.match(/user_id=eq\.([^&]+)/)?.[1] ?? "");
    const a = adminUsers[id];
    return Promise.resolve(new Response(JSON.stringify(a?.role === "admin" ? [{ user_id: id }] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/rdv_invoices?is_demo=eq.false&select=id,created_at")) {
    return Promise.resolve(new Response(JSON.stringify(invoices.filter((i) => !i.is_demo)), { status: 200 }));
  }
  if (url.includes("/rest/v1/rdv_invoices?broker_id=eq.")) {
    const id = decodeURIComponent(url.match(/broker_id=eq\.([^&]+)/)?.[1] ?? "");
    const monthStart = decodeURIComponent(url.match(/created_at=gte\.([^&]+)/)?.[1] ?? "");
    const rows = invoices.filter((i) => i.broker_id === id && i.status === "paid" && !i.is_demo && i.created_at >= monthStart);
    return Promise.resolve(new Response(JSON.stringify(rows.map((r) => ({ amount_chf: r.amount_chf }))), { status: 200 }));
  }
  if (url.includes("/rest/v1/rdv_invoices?status=eq.paid&is_demo=eq.false&select=amount_chf")) {
    const rows = invoices.filter((i) => i.status === "paid" && !i.is_demo);
    return Promise.resolve(new Response(JSON.stringify(rows.map((r) => ({ amount_chf: r.amount_chf }))), { status: 200 }));
  }
  throw new Error(`URL non mockee: ${url}`);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("admin-invoices-data", () => {
  it("appelant non-admin -> refusé", async () => {
    const res = await handleAdminInvoicesDataRequest(reqWithAuth("caller-commercial", { action: "list_all" }), ENV);
    expect(res.status).toBe(500);
    expect(String((await res.json()).error)).toContain("Réservé aux administrateurs");
  });

  it("list_all -> toutes les factures non-demo, tous courtiers, is_demo exclu", async () => {
    const res = await handleAdminInvoicesDataRequest(reqWithAuth("caller-admin", { action: "list_all" }), ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invoices).toHaveLength(3);
    expect(body.invoices.some((i: any) => i.id === "inv-3")).toBe(false);
  });

  it("sum_paid -> somme payées + non-demo, tous courtiers", async () => {
    const res = await handleAdminInvoicesDataRequest(reqWithAuth("caller-admin", { action: "sum_paid" }), ENV);
    expect(res.status).toBe(200);
    expect((await res.json()).totalCents).toBe(17000); // inv-1 + inv-4
  });

  it("sum_paid_by_broker -> somme bornée à un courtier et une fenêtre de date", async () => {
    const res = await handleAdminInvoicesDataRequest(
      reqWithAuth("caller-admin", { action: "sum_paid_by_broker", brokerId: BROKER_A, monthStart: "2026-01-01T00:00:00.000Z" }),
      ENV,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).totalCents).toBe(10000); // inv-1 seulement (inv-4 est de décembre, inv-3 est demo)
  });

  it("sum_paid_by_broker -> brokerId invalide refusé", async () => {
    const res = await handleAdminInvoicesDataRequest(
      reqWithAuth("caller-admin", { action: "sum_paid_by_broker", brokerId: "pas-un-uuid", monthStart: "2026-01-01T00:00:00.000Z" }),
      ENV,
    );
    expect(res.status).toBe(500);
    expect(String((await res.json()).error)).toContain("invalide");
  });

  it("sum_paid_by_broker -> monthStart invalide refusé", async () => {
    const res = await handleAdminInvoicesDataRequest(
      reqWithAuth("caller-admin", { action: "sum_paid_by_broker", brokerId: BROKER_A, monthStart: "2026-01-01" }),
      ENV,
    );
    expect(res.status).toBe(500);
    expect(String((await res.json()).error)).toContain("invalide");
  });

  it("action inconnue -> refusée", async () => {
    const res = await handleAdminInvoicesDataRequest(reqWithAuth("caller-admin", { action: "bogus" }), ENV);
    expect(res.status).toBe(500);
    expect(String((await res.json()).error)).toContain("Action inconnue");
  });
});
