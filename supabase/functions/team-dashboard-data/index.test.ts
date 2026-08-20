import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleTeamDashboardDataRequest, type Env } from "./index";

// Avant le correctif, cette fonction faisait confiance a `requesterId` lu
// depuis le body de la requete : n'importe quel utilisateur authentifie
// pouvait lire le dashboard (revenus, clients, emails) de N'IMPORTE QUEL
// cabinet en changeant cet id. Ces tests prouvent que l'identite vient
// desormais exclusivement du JWT verifie par la passerelle Supabase.

const SUPABASE_URL = "https://fake.supabase.co";
const SUPABASE_KEY = "fake-service-role-key";
const ENV: Env = { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY };

function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.fakesig`;
}

function reqWithAuth(userId: string | null, body: Record<string, unknown> = {}): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (userId) headers.Authorization = `Bearer ${fakeJwt({ sub: userId })}`;
  return new Request("https://edge.local/team-dashboard-data", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const profiles = [
  {
    id: "root-A",
    cabinet_role: "root_director",
    cabinet_root_id: "root-A",
    first_name: "Alice",
    last_name: "A",
    email: "a@x.ch",
    brokerage_name: "Cabinet A",
  },
  {
    id: "root-C",
    cabinet_role: "root_director",
    cabinet_root_id: "root-C",
    first_name: "Carla",
    last_name: "C",
    email: "c@x.ch",
    brokerage_name: "Cabinet C",
  },
];

function countResponse(count: number): Response {
  return new Response(JSON.stringify([]), {
    status: 200,
    headers: { "content-range": `0-0/${count}` },
  });
}

function mockFetch(input: string | URL | Request): Promise<Response> {
  const url = String(input);

  if (url.includes("/rest/v1/profiles?id=eq.")) {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    const match = profiles.filter((p) => p.id === id);
    return Promise.resolve(new Response(JSON.stringify(match), { status: 200 }));
  }
  if (
    url.includes("/rest/v1/profiles?cabinet_root_id=eq.") &&
    url.includes("cabinet_role=eq.director")
  ) {
    return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
  }
  if (url.includes("/rest/v1/profiles?manager_id=eq.")) {
    return Promise.resolve(new Response(JSON.stringify([]), { status: 200 })); // pas de courtiers
  }
  if (url.includes("archived=eq.false")) {
    return Promise.resolve(countResponse(0));
  }
  if (url.includes("/rest/v1/rdv_invoices")) {
    return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
  }
  if (url.includes("/rest/v1/clients?broker_id=in.") && url.includes("created_at=lt.")) {
    return Promise.resolve(countResponse(0));
  }
  if (url.includes("/rest/v1/clients?broker_id=in.")) {
    return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
  }
  if (url.includes("/rest/v1/cabinet_invites")) {
    return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
  }
  throw new Error(`URL non mockee: ${url}`);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("team-dashboard-data — identité dérivée du JWT", () => {
  it("sans Authorization -> refus, aucune requête base n'est faite", async () => {
    const res = await handleTeamDashboardDataRequest(reqWithAuth(null), ENV);
    expect(res.status).toBe(500); // même convention d'erreur que le reste du code
    const body = await res.json();
    expect(String(body.error)).toContain("Authentification requise");
  });

  it("un requesterId envoyé dans le body est totalement ignoré : c'est le JWT qui fait foi", async () => {
    // Avant le correctif, ceci aurait permis de lire le dashboard de root-C
    // en étant authentifié en tant que root-A.
    const req = reqWithAuth("root-A", { requesterId: "root-C" });
    const res = await handleTeamDashboardDataRequest(req, ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requester.id).toBe("root-A");
    expect(body.requester.id).not.toBe("root-C");
  });

  it("l'appelant voit ses propres données quand le JWT est valide (comportement normal préservé)", async () => {
    const req = reqWithAuth("root-A");
    const res = await handleTeamDashboardDataRequest(req, ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requester.id).toBe("root-A");
    expect(body.requester.brokerage_name).toBe("Cabinet A");
  });
});
