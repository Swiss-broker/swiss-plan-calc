import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleTeamPostAnnouncementRequest, type Env } from "./index";

// Avant le correctif : `posterId` ET `cabinetRootId` venaient tous les deux
// du body. Même avec posterId corrigé, un cabinetRootId arbitraire aurait
// permis à n'importe quel directeur d'injecter une annonce dans le flux
// d'un AUTRE cabinet que le sien. Les deux doivent désormais être dérivés
// côté serveur.

const SUPABASE_URL = "https://fake.supabase.co";
const SUPABASE_KEY = "fake-service-role-key";
const ENV: Env = { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY };

function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.fakesig`;
}

function reqWithAuth(userId: string | null, body: Record<string, unknown>): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (userId) headers.Authorization = `Bearer ${fakeJwt({ sub: userId })}`;
  return new Request("https://edge.local/team-post-announcement", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const profiles: Record<
  string,
  { cabinet_role: string | null; cabinet_root_id: string | null; manager_id?: string }
> = {
  "director-A": { cabinet_role: "root_director", cabinet_root_id: "director-A" },
  "director-B": { cabinet_role: "root_director", cabinet_root_id: "director-B" },
  "courtier-A": {
    cabinet_role: "courtier",
    cabinet_root_id: "director-A",
    manager_id: "director-A",
  },
  "courtier-B": {
    cabinet_role: "courtier",
    cabinet_root_id: "director-B",
    manager_id: "director-B",
  },
};

let inserted: unknown[] = [];

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  if (
    url.includes("/rest/v1/profiles?id=eq.") &&
    url.includes("select=cabinet_role,cabinet_root_id")
  ) {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    const p = profiles[id];
    return Promise.resolve(new Response(JSON.stringify(p ? [p] : []), { status: 200 }));
  }
  if (
    url.includes("/rest/v1/profiles?id=eq.") &&
    url.includes("select=manager_id,cabinet_root_id")
  ) {
    const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)?.[1] ?? "");
    const p = profiles[id];
    return Promise.resolve(
      new Response(
        JSON.stringify(p ? [{ manager_id: p.manager_id, cabinet_root_id: p.cabinet_root_id }] : []),
        {
          status: 200,
        },
      ),
    );
  }
  if (url.includes("/rest/v1/team_announcements")) {
    const body = JSON.parse(String(init?.body ?? "{}"));
    inserted.push(body);
    return Promise.resolve(
      new Response(JSON.stringify([{ id: "ann-new", ...body }]), { status: 201 }),
    );
  }
  throw new Error(`URL non mockee: ${url}`);
}

beforeEach(() => {
  inserted = [];
  vi.stubGlobal("fetch", vi.fn(mockFetch));
});

describe("team-post-announcement — identité et cabinet dérivés du JWT", () => {
  it("posterId ET cabinetRootId falsifiés dans le body sont ignorés", async () => {
    // Le directeur A tente d'injecter une annonce dans le cabinet B en
    // fournissant un cabinetRootId falsifié : ça doit toujours atterrir
    // dans SON propre cabinet (A), jamais dans celui de B.
    const req = reqWithAuth("director-A", {
      posterId: "director-B",
      cabinetRootId: "director-B",
      message: "Test",
    });
    const res = await handleTeamPostAnnouncementRequest(req, ENV);
    expect(res.status).toBe(200);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ posted_by: "director-A", cabinet_root_id: "director-A" });
  });

  it("un compte non-directeur ne peut pas poster", async () => {
    const req = reqWithAuth("courtier-A", { message: "Test" });
    const res = await handleTeamPostAnnouncementRequest(req, ENV);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("Seuls les directeurs");
    expect(inserted).toHaveLength(0);
  });

  it("ciblage d'un membre d'un AUTRE cabinet est toujours refusé", async () => {
    const req = reqWithAuth("director-A", { message: "Test", targetId: "courtier-B" });
    const res = await handleTeamPostAnnouncementRequest(req, ENV);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("ne fait pas partie de votre équipe");
    expect(inserted).toHaveLength(0);
  });

  it("ciblage d'un membre de son propre cabinet fonctionne normalement", async () => {
    const req = reqWithAuth("director-A", { message: "Test", targetId: "courtier-A" });
    const res = await handleTeamPostAnnouncementRequest(req, ENV);
    expect(res.status).toBe(200);
    expect(inserted[0]).toMatchObject({ target_id: "courtier-A", cabinet_root_id: "director-A" });
  });

  it("sans Authorization -> refus", async () => {
    const res = await handleTeamPostAnnouncementRequest(
      reqWithAuth(null, { message: "Test" }),
      ENV,
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.error)).toContain("Authentification requise");
  });
});
