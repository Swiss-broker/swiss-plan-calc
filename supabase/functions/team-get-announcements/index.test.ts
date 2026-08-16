import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleTeamGetAnnouncementsRequest, type Env } from "./index";

// Avant le correctif, `requesterId` venait du body : n'importe quel compte
// authentifié pouvait lire les annonces internes de n'importe quel cabinet.

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
  return new Request("https://edge.local/team-get-announcements", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const profiles: Record<string, { cabinet_root_id: string | null }> = {
  "user-A": { cabinet_root_id: "cabinet-A" },
  "user-B": { cabinet_root_id: "cabinet-B" },
  "user-orphan": { cabinet_root_id: null },
};

const announcementsByCabinet: Record<string, unknown[]> = {
  "cabinet-A": [
    { id: "ann-1", message: "Réunion cabinet A", posted_by: "user-A", target_id: null },
  ],
  "cabinet-B": [{ id: "ann-2", message: "Secret cabinet B", posted_by: "user-B", target_id: null }],
};

function mockFetch(input: string | URL | Request): Promise<Response> {
  const url = String(input);
  if (url.includes("/rest/v1/profiles?id=eq.")) {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    const p = profiles[id];
    return Promise.resolve(new Response(JSON.stringify(p ? [p] : []), { status: 200 }));
  }
  if (url.includes("/rest/v1/team_announcements")) {
    const cabinetId = decodeURIComponent(url.match(/cabinet_root_id=eq\.([^&]+)/)?.[1] ?? "");
    return Promise.resolve(
      new Response(JSON.stringify(announcementsByCabinet[cabinetId] ?? []), { status: 200 }),
    );
  }
  throw new Error(`URL non mockee: ${url}`);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("team-get-announcements — identité dérivée du JWT", () => {
  it("sans Authorization -> refus", async () => {
    const res = await handleTeamGetAnnouncementsRequest(reqWithAuth(null), ENV);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("Authentification requise");
  });

  it("un requesterId falsifié dans le body est ignoré : impossible de lire les annonces d'un autre cabinet", async () => {
    // Avant le correctif : requesterId="user-B" dans le body suffisait à
    // lire les annonces du cabinet B, quel que soit le compte réellement
    // authentifié.
    const req = reqWithAuth("user-A", { requesterId: "user-B" });
    const res = await handleTeamGetAnnouncementsRequest(req, ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.announcements).toEqual(announcementsByCabinet["cabinet-A"]);
    expect(body.announcements).not.toEqual(announcementsByCabinet["cabinet-B"]);
  });

  it("compte sans cabinet -> refus explicite", async () => {
    const req = reqWithAuth("user-orphan");
    const res = await handleTeamGetAnnouncementsRequest(req, ENV);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("ne fait pas partie d'un cabinet");
  });
});
